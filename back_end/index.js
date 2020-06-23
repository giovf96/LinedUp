"use strict";
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = "secretkey23456";

const app = express();
const router = express.Router();
app.use(cors())

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
const database = new sqlite3.Database("./my.db");

const universities = {
    "Sapienza": {
        faculties: [
            "Engineering in Computer Science",
            "Ingegneria dell'Informazione",
            "Legge",
            "Economia"
        ],
        places: [
            {
                name: "Segreteria Didattica",
                type: "secretariat",
                status: 0
            },
            {
                name: "Ricevimento Professore",
                status: 1,
                type: "office hours",
                hour: "16:00-18:00"
            },
            {
                name: "Mensa",
                status: 1,
                type: "canteen",
                hour: "11:30-15:00"
            }
        ]
    },
    "RomaTre": {
        faculties:
            [
                "Ingegneria Informatica",
                "Medicina",
                "Scienza della Formazione",
                "Matematica"
            ]
    }
}

const createUsersTable = () => {
    const sqlQuery = `
        CREATE TABLE IF NOT EXISTS users (
        id integer PRIMARY KEY,
        name text,
        surname text,
        birthdate text,
        university text,
        faculty text,
        email text UNIQUE,
        password text)`;

    return database.run(sqlQuery);
}

const findUserByEmail = (email, cb) => {
    return database.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
        cb(err, row)
    });
}

const createUser = (user, cb) => {
    return database.run('INSERT INTO users (name, surname, email, birthdate, university, faculty, password) VALUES (?,?,?,?,?,?,?)', user, (err) => {
        cb(err)
    });
}

createUsersTable();

router.get('/', (req, res) => {
    res.status(200).send('This is an authentication server');
});

router.get('/universities', (req, res) => {
    res.status(200).send(universities);
});

router.post('/positions', (req, res) => {
    console.log("/positions: received %o", req.body);
    if (req.body.university && req.body.position) {
        let userPosition = req.body.position;
        let places = universities[req.body.university].places;
        places.forEach((place, index) => {
            let lon = userPosition.longitude + 0.0003 + index * 0.0001 * (index % 2 == 0 ? -1 : 1);
            let lat = userPosition.latitude + 0.0003 + index * 0.0001 * (index % 2 == 0 ? -1 : 1);
            place["position"] = { lon: lon, lat: lat };
        });
        
        res.status(200).send(places);
    }
    else {
        res.status(404).send("no university specified");
    }
});

router.post('/register', (req, res) => {

    const name = req.body.name;
    const surname = req.body.surname;
    const email = req.body.email;
    const birthDate = req.body.birthDate;
    const university = req.body.university;
    const faculty = req.body.faculty;
    console.log(req.body);
    const password = bcrypt.hashSync(req.body.password);

    createUser([name, surname, email, birthDate, university, faculty, password], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Server error!");
        }
        findUserByEmail(email, (err, user) => {
            if (err) return res.status(500).send('Server error!');
            const expiresIn = 24 * 60 * 60;
            const accessToken = jwt.sign({ id: user.id }, SECRET_KEY, {
                expiresIn: expiresIn
            });
            res.status(200).send({
                "user": user, "access_token": accessToken, "expires_in": expiresIn
            });
        });
    });
});


router.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    findUserByEmail(email, (err, user) => {
        if (err) return res.status(500).send('Server error!');
        if (!user) return res.status(404).send('User not found!');
        const result = bcrypt.compareSync(password, user.password);
        if (!result) return res.status(401).send('Password not valid!');

        const expiresIn = 24 * 60 * 60;
        const accessToken = jwt.sign({ id: user.id }, SECRET_KEY, {
            expiresIn: expiresIn
        });
        res.status(200).send({ "user": user, "access_token": accessToken, "expires_in": expiresIn });
    });
});

app.use(router);
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.log('Server listening at http://localhost:' + port);
}); 