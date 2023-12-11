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
        console.log("Database Connected")
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
            console.log(error)
            return res.status(500).json({
                error: true,
                status: 500,
                message: "Internal Server Error"
            })
        }

        if(results.length > 0){
            return res.status(409).json(
                {
                    error: true,
                    status: 409,
                    message: "Username telah terdaftar"
                }
            )
        }

        db.query('SELECT email from users WHERE email = ?', [email], async (error, results) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Internal Server Error"
                })
            }
    
            if(results.length > 0){
                return res.status(409).json({
                        error: true,
                        status: 409,
                        message: "Email telah terdaftar"
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
                        message: "Internal Server Error"
                    })
                } else {
                    return res.status(201).json({ 
                            error: false,
                            status: 201,
                            message: "Berhasil Registrasi"
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
                message: "Internal Server Error"
            })
        }

        if(results.length > 0) {
            const user = results[0]
            const isPasswordValid = await bcrypt.compare(password, user.password)
            if(isPasswordValid){
                return res.status(201).json({ 
                        error: false,
                        status: 201,
                        message: "Login Berhasil",
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
                    message: "Password Salah"
                })
            }
        } else {
            return res.status(401).json({
                error: true,
                status: 401,
                message: "Email Salah"
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
        const currentDate = new Date()
        const formattedDate = currentDate.toLocaleDateString('en-CA');

        db.query('INSERT INTO history_prediction SET ?', {historyId:historyId, prediction: response.data.prediction, date: formattedDate, userId: userId}, (error) => {
            if(error){
                console.log(error)
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Gagal Insert Database"
                })
            } else {
                return res.status(201).json({
                    error: false,
                    status: 201,
                    prediction: response.data.prediction,
                    message: "Berhasil melakukan request"
                })
            }
        })
    } catch (error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Terjadi kesalahan saat melakukan permintaan",
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
            message: 'Permintaan berhasil',
        };

        res.status(201).json(responseData)
    } catch (error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Terjadi kesalahan saat melakukan permintaan",
        })
    }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log('Server Started'))