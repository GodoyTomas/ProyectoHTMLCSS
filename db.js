const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'qn-mjv.h.filess.io',
    port: 3306,
    user: 'uniempleos_earnsweet',
    password: 'de84e58da1b756e4380bdcc12fd54cd2352fc2da',
    database: 'uniempleos_earnsweet',
    waitForConnections: true,
    connectionLimit: 5 // Límite ideal para el plan gratuito de Filess.io
});

module.exports = pool;