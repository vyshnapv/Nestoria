const mongoose = require('mongoose');
const env=require('dotenv').config();

const connectdb=async()=>{
    mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("Connected to MongoDB");
})
.catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});
}


module.exports = connectdb;