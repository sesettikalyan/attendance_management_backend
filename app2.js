const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

const secretKey = 'your_secret_key'; // Replace with a secure secret key

// Simulated user database (you should use a real database)
const users = [
    { idNumber: '12345', password: 'password123', username: 'user1' },
    { idNumber: '54321', password: 'securepass', username: 'user2' }
];

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (typeof token !== 'undefined') {
        jwt.verify(token, secretKey, (err, authData) => {
            if (err) {
                console.log(token);
                res.sendStatus(403); // Forbidden

            } else {
                req.user = authData;
                next();
            }
        });
    } else {
        res.sendStatus(403); // Forbidden
    }
}

// Endpoint for login using idNumber and password
app.post('/login', (req, res) => {
    const { idNumber, password } = req.body;
    const user = users.find(user => user.idNumber === idNumber && user.password === password);

    if (user) {
        const token = jwt.sign({ username: user.username }, secretKey, { expiresIn: '30d' }); // 30 days
        res.json({ token });
    } else {
        res.sendStatus(401); // Unauthorized
    }
});

// Protected route using the verifyToken middleware
app.get('/protected', verifyToken, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
