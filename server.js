require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const cors = require('cors');
const userRoute = require('./routes/userRoute');
const kerelmekRoute = require('./routes/kerelmekRoute');
const szabadsagokRoute = require('./routes/szabadsagokRoute');
const uzenetekRoute = require('./routes/uzenetekRoute');
const plansRoute = require('./routes/plansRoute');
const tappenzRoute = require('./routes/tappenzRoute');
const { Client } = require('node-appwrite');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const client = new Client();
client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

// app.use(userRoute);
// app.use(kerelmekRoute);
// app.use(szabadsagokRoute);
// app.use(uzenetekRoute);
// app.use(plansRoute);
// app.use(tappenzRoute);

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});