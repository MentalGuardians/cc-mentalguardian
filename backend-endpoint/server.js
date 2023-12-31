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
            return res.status(409).json({
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
        return res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.get("/predict", (req, res) => {
    try {
        const userId = req.query.userId

        db.query('SELECT * FROM history_prediction WHERE userId = ? ORDER BY STR_TO_DATE(date, "%Y-%m-%d %H:%i") DESC', [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            } else {
                return res.status(200).json({
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
        return res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.post("/content-recommender", async (req, res) => {
    try {
        const content = req.body.content;
        const url = 'https://contentrecommenderrev-earot3fyaq-de.a.run.app/contentrecommender';
        const requestBody = {
            content: content,
        }

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        })

        const cleanedResponse = response.data.replace(/NaN/g, 'null')
        const responseData = JSON.parse(cleanedResponse)

        let contentIds = []

        const queryPromises = responseData.result.map(async (result) => {
            return new Promise((resolve, reject) => {
                db.query('SELECT thumbnail,contentId FROM contents WHERE `Video ID` = ?', [result["Video ID"]], (error, resultQuery) => {
                    if (error) {
                        reject(error);
                    } else {
                        const contentId = resultQuery[0].contentId;
                        contentIds.push(contentId);
        
                        if (resultQuery[0].thumbnail == null) {
                            db.query('UPDATE contents SET thumbnail = ? WHERE contentId = ?', [result.Thumbnail, resultQuery[0].contentId], (error, resultInsert) => {
                                if (error) {
                                    // Instead of returning a response here, you can send an error response and break the loop
                                    reject(error);
                                } else {
                                    resolve();
                                }
                            });
                        } else {
                            resolve();
                        }
                    }
                });
            });
        });
        
        // Wait for all query operations to complete
        await Promise.all(queryPromises);
    
        for (let i = 0; i < responseData.result.length; i++) {
            responseData.result[i].contentId = contentIds[i];
        }
    
        const responseFinal = {
            statusCode: response.status,
            ...responseData,
            message: 'Request successful',
        }
    
        res.status(201).json(responseFinal);
    } catch (error) {
        res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        });
    }
});

app.get("/content-recommender", (req, res) => {
    try{
        const contentId = req.query.contentId

        db.query('SELECT * FROM contents WHERE contentId = ?', [contentId], (error, result) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            }else{
                if(result.length > 0){
                    return res.status(200).json({
                        error: false,
                        status: 200,
                        message: "Request successful",
                        data: result.length > 0 ? {
                            Author: result[0].Author,
                            Comments: result[0].Comments,
                            Labels: result[0].Labels,
                            Likes: result[0].Likes,
                            Thumbnail: result[0].thumbnail,
                            Title: result[0].Title,
                            ["Video ID"]: result[0]["Video ID"],
                            Views: result[0].Views,
                            contentId: contentId,
                        } : null
                    });                    
                }else{
                    return res.status(500).json({
                        error: true,
                        status: 500,
                        message: "Content not found"
                    })
                }
            }
        })
    }catch (error){
        return res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.post("/expert-recommender", async (req, res) => {
    try {
        const expert = req.body.expert
        const url = 'https://expertrecommenderrev-earot3fyaq-de.a.run.app/expertrecommender'
        const requestBody = {
            expert: expert,
        }

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        })

        let therapistIds = []

        const queryPromises = response.data.result.map(async (result) => {
            return new Promise((resolve, reject) => {
                db.query('SELECT therapistId FROM therapists WHERE Name = ?', [result["Name"]], (error, resultQuery) => {
                    if (error) {
                        reject(error);
                    } else {
                        const therapistId = resultQuery[0].therapistId;
                        therapistIds.push(therapistId);
                        resolve();
                    }
                })
            })
        })
    
        // Menunggu semua operasi query selesai
        await Promise.all(queryPromises);

        for (let i = 0; i < response.data.result.length; i++) {
            response.data.result[i].therapistId = therapistIds[i];
        }

        const responseData = {
            statusCode: response.status,
            ...response.data,
            message: 'Request successful',
        }

        return res.status(201).json(responseData)
    } catch (error) {
        return res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.get("/expert-recommender", (req, res) => {
    try{
        const therapistId = req.query.therapistId

        db.query('SELECT * FROM therapists WHERE therapistId = ?', [therapistId], (error, result) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            }else{
                if(result.length > 0){
                    return res.status(200).json({
                        error: false,
                        status: 200,
                        message: "Request successful",
                        data: result.length > 0 ? {
                            Age: result[0].Age,
                            Category: result[0].Category,
                            Domicile: result[0].Domicile,
                            Gender: result[0].Gender,
                            Methods: result[0].Methods,
                            Name: result[0].Name,
                            Price: result[0].Price,
                            Rating: result[0].Rating,
                            Status: result[0].Status,
                            ["User Viewed"]: result[0]["User Viewed"],
                            therapistId: therapistId,
                        } : null
                    })
                }else{
                    return res.status(500).json({
                        error: true,
                        status: 500,
                        message: "Expert not found"
                    })
                }
            }
        })
    }catch (error){
        return res.status(500).json({
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
                })
            } else {
                return res.status(200).json({
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
        return res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.put("/profile", (req, res) => {
    try {
        const userId = req.query.userId

        let usernameCurrent, emailCurrent

        const username = req.body.username
        const password = req.body.password
        const email = req.body.email
        const phone = req.body.phone
        const alamat = req.body.alamat

        db.query('SELECT username, email from users WHERE userId = ?', [userId], (error, results) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            }else{
                usernameCurrent = results[0].username
                emailCurrent = results[0].email
            }
        })

        db.query('SELECT username from users WHERE username = ?', [username], (error, results) => {
            if(error){
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            }
    
            if(results.length > 0){
                if(username !== usernameCurrent){
                    return res.status(409).json({
                        error: true,
                        status: 409,
                        message: "Username is already taken"
                    })
                }
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
                    if(email !== emailCurrent){
                        return res.status(409).json({
                            error: true,
                            status: 409,
                            message: "Email is already taken"
                        })
                    }
                }

                let hashedPassword = await bcrypt.hash(password, 10);
                db.query('UPDATE users SET username = ?, password = ?, email = ?, phone = ?, alamat = ? WHERE userId = ?', [username, hashedPassword, email, phone, alamat, userId], (error, result) => {
                    if (error) {
                        return res.status(500).json({
                            error: true,
                            status: 500,
                            message: "Query error",
                        })
                    } else {
                        return res.status(200).json({
                            error: false,
                            status: 200,
                            message: "Data updated successfully",
                            updatedUserId: userId,
                        })
                    }
                })
            })
        })
    } catch (error) {
        return res.status(500).json({
            error: true,
            status: 500,
            message: "Internal server error",
        })
    }
})

app.post("/booking", async (req, res) => {
    try {
        const userId = req.body.userId
        const teraphistId = req.body.therapistId
        const tanggal_konseling = req.body.tanggal_konseling
        const jam_konseling = req.body.jam_konseling
        const jenis_konseling = req.body.jenis_konseling

        const bookingId = nanoid(16)

        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Perlu ditambah 1 karena bulan dimulai dari 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const hours = currentDate.getHours().toString().padStart(2, '0');
        const minutes = currentDate.getMinutes().toString().padStart(2, '0');
        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;

        let link = "meet.google.com/ozg-zmqx-fdk"
        if(jenis_konseling == "Offline" || jenis_konseling == "offline" || jenis_konseling == "OFFLINE"){
            link = null
        }

        db.query('INSERT INTO history_booking SET ?', {bookingId:bookingId, tanggal_booking: formattedDate, tanggal_konseling: tanggal_konseling, jam_konseling: jam_konseling, jenis_konseling : jenis_konseling, link: link, status: 1, userId: userId, therapistId: teraphistId}, (error) => {
            if(error){
                console.log(error)
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            } else {
                return res.status(201).json({
                    error: false,
                    status: 201,
                    bookingId: bookingId,
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

app.get("/booking", (req, res) => {
    try {
        const userId = req.query.userId

        db.query('SELECT * FROM history_booking WHERE userId = ? ORDER BY STR_TO_DATE(tanggal_booking, "%Y-%m-%d %H:%i") DESC', [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    error: true,
                    status: 500,
                    message: "Query error"
                })
            } else {
                res.status(200).json({
                    error: false,
                    status: 200,
                    userId: userId,
                    historyBooking: result.map(item => {
                        const combinedDateTimeString = `${item.tanggal_konseling} ${item.jam_konseling}`;
                        const combinedDateTime = new Date(combinedDateTimeString);
                
                        let status;
                        if (item.status == 1) {
                            const currentDate = new Date();
                            if (currentDate > combinedDateTime) {
                                status = "Finished";
                            } else {
                                status = "Scheduled";
                            }
                        } else {
                            status = "Canceled";
                        }
                
                        return {
                            bookingId: item.bookingId,
                            tanggal_booking: item.tanggal_booking,
                            tanggal_konseling: item.tanggal_konseling,
                            jam_konseling: item.jam_konseling,
                            jenis_konseling: item.jenis_konseling,
                            link: item.link,
                            status: status,
                            therapistId: item.therapistId
                        }
                    }),
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

app.put("/booking", (req, res) => {
    const bookingId = req.query.bookingId

    db.query('UPDATE history_booking SET status = ? WHERE bookingId = ?', ["cancel", bookingId], (error, result) => {
        if (error) {
            return res.status(500).json({
                error: true,
                status: 500,
                message: "Query error",
            })
        } else {
            return res.status(200).json({
                error: false,
                status: 200,
                message: "Booking canceled",
                bookingId: bookingId,
            })
        }
    })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log('Server started'))