const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'TU_HOST_MYSQL',
    port: 3306,
    user: 'TU_USUARIO',
    password: 'TU_PASSWORD',
    database: 'TU_BASE_DE_DATOS',
    waitForConnections: true,
    connectionLimit: 5
});

module.exports = pool;