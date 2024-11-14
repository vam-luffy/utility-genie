const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL connection setup
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'utility_management',
    password: 'vamban0940'
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: false,
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.status(403).send('<script>alert("Please log in to access this feature."); window.location.href="/login";</script>');
}

// Routes
app.get('/', (req, res) => {
    const confirmationMessage = req.query.confirmation ? 'Thank you for your booking! A confirmation has been sent to your mobile number.' : null;
    res.render('home', { user: req.session.user, confirmationMessage });
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/work-with-us', (req, res) => {
    res.render('work_with_us');
});

app.get('/application_form', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    const applicationQuery = `
        SELECT * FROM workers 
        WHERE user_id = ?`;
    
    connection.query(applicationQuery, [userId], (appError, appResults) => {
        if (appError) {
            console.error(appError);
            return res.status(500).send('Server error');
        }

        if (appResults.length > 0) {
            return res.redirect('/worker-dashboard');
        }

        res.render('application_form');
    });
});

// Other service routes
app.get('/plumbers', isAuthenticated, (req, res) => {
    res.render('plumbers');
});

app.get('/electricians', isAuthenticated, (req, res) => {
    res.render('electricians');
});

app.get('/mechanics', isAuthenticated, (req, res) => {
    res.render('mechanics');
});

// Worker Dashboard Route
app.get('/worker-dashboard', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    const userQuery = `
        SELECT Userss.*, workers.profession, workers.location 
        FROM Userss 
        LEFT JOIN workers ON Userss.id = workers.user_id 
        WHERE Userss.id = ?`;

    connection.query(userQuery, [userId], (error, userResults) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Server error');
        }

        const user = userResults[0];

        // Fetch the worker's tasks (including bookings)
        const tasksQuery = `
            SELECT * FROM bookings 
            WHERE user_id = ?`;
            
        connection.query(tasksQuery, [userId], (tasksError, tasks) => {
            if (tasksError) {
                console.error(tasksError);
                return res.status(500).send('Server error');
            }

            const applicationQuery = `SELECT * FROM workers WHERE user_id = ?`;
            connection.query(applicationQuery, [userId], (appError, appResults) => {
                if (appError) {
                    console.error(appError);
                    return res.status(500).send('Server error');
                }

                const application = appResults.length > 0 ? appResults[0] : null;

                res.render('worker_dashboard', {
                    user: {
                        ...user,
                        profession: user.profession,
                        location: user.location
                    },
                    tasks: tasks,  // Pass the tasks (bookings) to the view
                    application: application
                });
            });
        });
    });
});


app.post('/signup', async (req, res) => {
    const { username, email, password, 'confirm-password': confirmPassword, profession, location, phone } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const checkEmailSql = 'SELECT * FROM Userss WHERE email = ?';
        connection.query(checkEmailSql, [email], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            if (results.length > 0) {
                return res.redirect('/login?error=emailInUse');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO Userss (username, email, password, profession, location, phone) VALUES (?, ?, ?, ?, ?, ?)';
            connection.query(sql, [username, email, hashedPassword, profession, location, phone || null], (error) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Server error');
                }
                res.redirect('/login');
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// Login route
app.get('/login', (req, res) => {
    const errorMessage = req.query.error === 'emailInUse' ? 'This email is already in use. Please log in.' : null;
    res.render('login', { errorMessage });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    connection.query('SELECT * FROM Userss WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }

        if (results.length === 0) {
            return res.status(401).send('Invalid username or password');
        }

        const user = results[0];
        bcrypt.compare(password, user.password, (err, match) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server error');
            }

            if (!match) {
                return res.status(401).send('Invalid username or password');
            }

            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                profession: user.profession,
                location: user.location
            };

            const redirectPath = req.query.redirect === 'application_form' ? '/application_form' : '/';
            res.redirect(redirectPath);
        });
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.redirect('/');
        }
        res.redirect('/');
    });
});

// Application form submission route
app.post('/application_form', upload.single('profilePic'), async (req, res) => {
    const { name, governmentID, experience, profession, location } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
        return res.status(403).send('User not authenticated');
    }

    const profilePicPath = req.file ? `/uploads/${req.file.filename}` : null;
    const checkApplicationQuery = 'SELECT * FROM workers WHERE user_id = ?';
    connection.query(checkApplicationQuery, [userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            const updateApplicationQuery = `
                UPDATE workers 
                SET name = ?, government_id = ?, experience = ?, profession = ?, location = ?, profile_picture = ?
                WHERE user_id = ?`;
            connection.query(updateApplicationQuery, [name, governmentID, experience, profession, location, profilePicPath, userId], (updateError) => {
                if (updateError) {
                    console.error(updateError);
                    return res.status(500).send('Server error');
                }
                return res.redirect('/worker-dashboard');
            });
        } else {
            const insertApplicationQuery = `
                INSERT INTO workers (user_id, name, email, government_id, experience, profession, location, profile_picture)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            connection.query(insertApplicationQuery, [userId, name, req.session.user.email, governmentID, experience, profession, location, profilePicPath], (insertError) => {
                if (insertError) {
                    console.error(insertError);
                    return res.status(500).send('Server error');
                }
                return res.redirect('/worker-dashboard');
            });
        }
    });
});

// Route to display all registered providers
app.get('/find-providers', isAuthenticated, (req, res) => {
    const providersQuery = `
        SELECT Userss.username, Userss.email, workers.profession, workers.location, workers.profile_picture 
        FROM Userss 
        JOIN workers ON Userss.id = workers.user_id`;
    
    connection.query(providersQuery, (error, results) => {
        if (error) {
            console.error('Error fetching providers:', error);
            return res.status(500).send('Server error');
        }
        
        res.render('find_providers', { providers: results, user: req.session.user });
    });
});

// Route to display all registered providers with search functionality
app.get('/find_providers', isAuthenticated, (req, res) => {
    const profession = req.query.profession || ''; // Get the profession from the query, or default to an empty string

    // SQL query to fetch providers based on the selected profession
    let providersQuery = `
        SELECT Userss.username, Userss.email, workers.profession, workers.location, workers.profile_picture 
        FROM Userss 
        JOIN workers ON Userss.id = workers.user_id
    `;

    if (profession) {
        providersQuery += ` WHERE workers.profession = ?`; // Add profession filter to the query
    }

    connection.query(providersQuery, [profession], (error, results) => {
        if (error) {
            console.error('Error fetching providers:', error);
            return res.status(500).send('Server error');
        }

        // Check if no providers are found
        const noProvidersFound = results.length === 0;

        // Pass profession and noProvidersFound to the view
        res.render('find_providers', { 
            providers: results, 
            user: req.session.user,
            profession: profession,  // Ensure this is passed to the view
            noProvidersFound: noProvidersFound // Also pass the noProvidersFound flag
        });
    });
});

// Route to display the 'Book Now' page
app.get('/book-now/:username', isAuthenticated, (req, res) => {
    const { username } = req.params;
    
    // Query to get provider details by username
    const providerQuery = `
        SELECT Userss.username, Userss.email, workers.profession
        FROM Userss 
        JOIN workers ON Userss.id = workers.user_id
        WHERE Userss.username = ?
    `;
    
    connection.query(providerQuery, [username], (error, results) => {
        if (error) {
            console.error('Error fetching provider details:', error);
            return res.status(500).send('Server error');
        }
        
        if (results.length > 0) {
            const provider = results[0];
            res.render('book_now', { provider });
        } else {
            res.status(404).send('Provider not found');
        }
    });
});

// Route to handle booking form submission
app.post('/book-now/:username', isAuthenticated, (req, res) => {
    const { username } = req.params;
    const { address, work_description, date, time } = req.body;
    const userId = req.session.user.id;

    // Query to insert booking into the 'bookings' table
    const bookingQuery = `
        INSERT INTO bookings (user_id, provider_username, address, work_description, date, time)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    connection.query(bookingQuery, [userId, username, address, work_description, date, time], (error, result) => {
        if (error) {
            console.error('Error saving booking:', error);
            return res.status(500).send('Server error');
        }

        // After saving the booking, send the SMS
        sendBookingConfirmationSMS(userId, {
            username,
            address,
            work_description,
            date,
            time
        });

        // Redirect to the worker's dashboard to see the new task
        res.redirect('/worker-dashboard');
    });
});


// Function to send SMS confirmation
function sendBookingConfirmationSMS(userId, bookingDetails) {
    const getUserPhoneQuery = 'SELECT phone FROM Userss WHERE id = ?';

    connection.query(getUserPhoneQuery, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching user phone:', error);
            return;
        }

        if (!results[0]?.phone) {
            console.error('No phone number registered for SMS confirmation');
            return;
        }

        const userPhone = results[0].phone;

        // Format the SMS message
        const message = `Booking Confirmed! 
Service: ${bookingDetails.work_description}
Provider: ${bookingDetails.username}
Date: ${bookingDetails.date}
Time: ${bookingDetails.time}
Address: ${bookingDetails.address}`;

        // Send SMS using Twilio
        twilioClient.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: '+91' + userPhone // User's phone number
        })
        .then(message => {
            console.log('SMS sent successfully:', message.sid);
        })
        .catch(error => {
            console.error('Error sending SMS:', error);
        });
    });
}
// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});