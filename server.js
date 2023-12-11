const express = require('express')
const mysql = require('mysql')
const bcrypt = require('bcryptjs')
const { nanoid } = require('nanoid')
const axios = require('axios')

const app = express()

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mental-guardians'
})

db.connect((error) => {
    if(error){
        console.log(error)
    }else{
        console.log("Database connected")
    }
})

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.post("/register", (req, res) => {
    const username = req.body.username
    const email = req.body.email
    const password = req.body.password

    db.query('SELECT username from users WHERE username = ?', [username], (error, results) => {
        if(error){
            return res.status(500).json({
                error: true,
                status: 500,
                message: "Query error"
            })
        }

        if(results.length > 0){
            return res.status(409).json(
                {
                    error: true,
                    status: 409,
                    message: "Username is already taken"
                }
            )
        }

        db.query('SELECT email from users WHERE email = ?', [email], async (error, results) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            }
    
            if(results.length > 0){
                return res.status(409).json({
                        error: true,
                        status: 409,
                        message: "Email is already in use"
                    }
                )
            }
            
            const userId = nanoid(16)
            let hashedPassword = await bcrypt.hash(password, 10);
            const picture = 'https://storage.googleapis.com/mental-guardians-user-picture/user-picture.jpg'

            db.query('INSERT INTO users SET ?', {userId:userId, username: username, password: hashedPassword, email: email, picture: picture}, (error) => {
                if(error){
                    return res.status(500).json({
                        error: true,
                        status: 500,
                        message: "Internal server error"
                    })
                } else {
                    return res.status(201).json({ 
                            error: false,
                            status: 201,
                            message: "Registration successful"
                        }
                    )
                }
            })
        })
    })
})

app.post("/login", (req, res) => {
    const email = req.body.email
    const password = req.body.password

    db.query('SELECT * FROM users WHERE email = ?', [email], async (error, results) => {
        if(error){
            return res.status(500).json({
                error: true,
                status: 500,
                message: "Internal server error"
            })
        }

        if(results.length > 0) {
            const user = results[0]
            const isPasswordValid = await bcrypt.compare(password, user.password)
            if(isPasswordValid){
                return res.status(201).json({ 
                        error: false,
                        status: 201,
                        message: "Login successful",
                        loginResult: {
                            userId: user.userId,
                            username: user.username,
                            email: user.email,
                            picture: user.picture
                        }
                    }
                )
            } else {
                return res.status(401).json({
                    error: true,
                    status: 401,
                    message: "Password wrong"
                })
            }
        } else {
            return res.status(401).json({
                error: true,
                status: 401,
                message: "Email wrong"
            })
        }
    })
})

app.post('/predict', async (req, res) => {
    try {
        const userId = req.body.userId
        const mood = req.body.text
        const url = 'https://setpredictionrev-earot3fyaq-de.a.run.app/predict'
        const requestBody = {
            text: mood,
        }

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        })

        const historyId = nanoid(16)
        const currentDate = new Date();

        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Perlu ditambah 1 karena bulan dimulai dari 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const hours = currentDate.getHours().toString().padStart(2, '0');
        const minutes = currentDate.getMinutes().toString().padStart(2, '0');

        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;

        db.query('INSERT INTO history_prediction SET ?', {historyId:historyId, text:mood, prediction: response.data.prediction, date: formattedDate, userId: userId}, (error) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            } else {
                return res.status(201).json({
                    error: false,
                    status: 201,
                    prediction: response.data.prediction,
                    message: "Request successful"
                })
            }
        })
    } catch (error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
});

app.post("/content-recommender", async (req, res) => {
    try {
        const content = req.body.content
        const url = 'https://contentrecommender-earot3fyaq-de.a.run.app/contentrecommender'
        const requestBody = {
            content: content,
        }

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        })

        const responseData = {
            statusCode: response.status,
            ...response.data,
            message: 'Request successful',
        };

        res.status(201).json(responseData)
    } catch (error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.get("/history-predict", (req, res) => {
    try {
        const userId = req.query.userId

        db.query('SELECT * FROM history_prediction WHERE userId = ? ORDER BY STR_TO_DATE(date, "%Y-%m-%d %H:%i") DESC', [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                });
            } else {
                res.status(200).json({
                    error: false,
                    status: 200,
                    userId: userId,
                    historyData: result.map(item => ({
                        historyId: item.historyId,
                        text: item.text,
                        prediction: item.prediction,
                        date: item.date,
                    })),
                    message: "Request successful"
                })
            }
        })
    } catch(error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.get("/profile", (req, res) => {
    try {
        const userId = req.query.userId
        
        db.query('SELECT * FROM users WHERE userId = ?', [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                });
            } else {
                res.status(200).json({
                    error: false,
                    status: 200,
                    userId: userId,
                    username: result[0].username,
                    email: result[0].email,
                    picture: result[0].picture,
                    phone: result[0].phone,
                    gender: result[0].gender,
                    message: "Request successful"
                })
            }
        })
    } catch (error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log('Server started'))