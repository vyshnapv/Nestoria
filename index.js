const env=require('dotenv').config();
const mongoose = require("mongoose");
const express = require("express");
const path = require("path");
const session = require('express-session');
const nocache = require('nocache')
const passport=require("./config/passport");


const db=require("./config/database")
db();

const app = express();



app.use("/", express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, "public", 'uploads')));


app.use(express.json());

// app.use('/admin/dashboard',nocache())
// app.use('/',nocache())

app.use(nocache());

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000,
    }
}));


app.use(passport.initialize())
app.use(passport.session())

// for Routes
const user_route = require("./routes/userRoute");
const admin_route = require("./routes/adminRoute");

app.use("/", user_route);
app.use("/admin", admin_route);


app.set('view engine', 'ejs');

 
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});