const mongoose = require('mongoose');

const connectToDB = () => {
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('MongoDB Connected');
  }).catch(err => console.error(`Error in connect to DB : ${err}`));
}

module.exports = connectToDB;