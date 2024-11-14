# Management System

This is a Node.js and Express-based management system for handling user sessions, worker data, tasks, and bookings. It connects to a MySQL database to store and manage user and worker information, providing authentication and authorization features.

## Features

- User authentication and session management
- Worker and user profiles with customizable data fields
- Dashboard for managing worker tasks (bookings)
- Authorization middleware to protect routes
- Dynamic rendering of views with EJS templates

## Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 14.x or higher)
- [MySQL](https://www.mysql.com/) (version 5.7 or higher)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/management-system.git
   cd management-system
Install dependencies:

bash
Copy code
npm install
Configure MySQL Database:

Create a new MySQL database, e.g., management.
Update the database configuration in your index.js file with your MySQL credentials:
javascript
Copy code
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'your-username',
    password: 'your-password',
    database: 'management'
});
Set up environment variables (optional):

Create a .env file in the root directory and add your MySQL credentials:
plaintext
Copy code
DB_HOST=localhost
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=management
Set up the database tables:

Run the following SQL commands to create the necessary tables:

sql
Copy code
CREATE TABLE Userss (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE workers (
    user_id INT,
    profession VARCHAR(255),
    location VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES Userss(id)
);

CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    task_description VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES Userss(id)
);
Run the application:

bash
Copy code
node index.js
The server should start running at http://localhost:3000.

Usage
Login: Access the login page at http://localhost:3000/login.
Worker Dashboard: Once logged in, navigate to /worker-dashboard to view and manage worker details and bookings.
Logout: Use the logout endpoint to end the session.
Project Structure
index.js: Main server file. Handles routes, session management, and database connection.
views/: Contains EJS templates for rendering HTML views.
public/: Static files (CSS, JavaScript) for styling and client-side functionality.
Middleware
isAuthenticated: Protects routes by verifying if a user is logged in. Redirects unauthorized access to the login page.
Troubleshooting
Session undefined errors: If you encounter a Cannot read properties of undefined (reading 'id') error, ensure that:

You have logged in and have a valid session.
Your isAuthenticated middleware is correctly implemented.
The database and user tables are set up properly.
Database connection issues: Ensure MySQL is running and the credentials in index.js or .env are correct.

Port conflicts: If port 3000 is already in use, you can change the port number in index.js:

javascript
Copy code
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
License
This project is licensed under the MIT License.

Acknowledgments
Express.js
MySQL
Feel free to reach out for any assistance!

yaml
Copy code

---

This `README.md` provides a clear setup guide, usage instructions, and troubleshooting tips for common issues. Adjust any specific paths or details based on your project's exact setup.

