const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL connection setup
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'management',
    password: 'vamban0940'
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

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
    res.render('home', { user: req.session.user });
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

        // If application exists, redirect to worker dashboard
        if (appResults.length > 0) {
            return res.redirect('/worker-dashboard');
        }

        // If no application exists, render the application form
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
        SELECT users.*, workers.profession, workers.location 
        FROM users 
        LEFT JOIN workers ON users.id = workers.user_id 
        WHERE users.id = ?`;

    connection.query(userQuery, [userId], (error, userResults) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Server error');
        }

        const user = userResults[0];
        const tasksQuery = 'SELECT * FROM tasks WHERE user_id = ?';
        connection.query(tasksQuery, [userId], (tasksError, tasks) => {
            if (tasksError) {
                console.error(tasksError);
                return res.status(500).send('Server error');
            }

            // Fetch application details
            const applicationQuery = `
                SELECT * FROM workers 
                WHERE user_id = ?`;
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
                    tasks: tasks,
                    application: application // Include application details
                });
            });
        });
    });
});

// Signup route
app.post('/signup', async (req, res) => {
    const { username, email, password, 'confirm-password': confirmPassword, profession, location } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
        connection.query(checkEmailSql, [email], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error');
            }

            if (results.length > 0) {
                return res.redirect('/login?error=emailInUse');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO users (username, email, password, profession, location) VALUES (?, ?, ?, ?, ?)';
            connection.query(sql, [username, email, hashedPassword, profession, location], (error) => {
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

    connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
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

    const profilePicPath = req.file ? `/uploads/${req.file.filename}` : null; // Ensure this path is correct
    const checkApplicationQuery = 'SELECT * FROM workers WHERE user_id = ?';
    connection.query(checkApplicationQuery, [userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            // Existing application found, update it
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
            // No existing application found, insert a new one
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
