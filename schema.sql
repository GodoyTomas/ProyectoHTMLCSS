SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS mensajes;
DROP TABLE IF EXISTS postulaciones;
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS empresas;
DROP TABLE IF EXISTS estudiantes;
DROP TABLE IF EXISTS administradores;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Tabla de Administradores (Superusuarios)
CREATE TABLE administradores (
    id_admin INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuario Administrador por defecto
INSERT INTO administradores (nombre, email, password) 
VALUES ('Administrador General', 'admin@uniempleos.com', 'admin123');

-- Columnas de confirmación de lectura en postulaciones
ALTER TABLE postulaciones ADD COLUMN leido_por_empresa BOOLEAN DEFAULT FALSE;
ALTER TABLE postulaciones ADD COLUMN fecha_lectura TIMESTAMP NULL;

-- 2. Tabla de Estudiantes
CREATE TABLE estudiantes (
    id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    institucion VARCHAR(150) NOT NULL,
    carrera VARCHAR(120) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    telefono VARCHAR(50) NOT NULL,
    linkedin_url VARCHAR(255),
    github_portfolio_url VARCHAR(255),
    instagram_url VARCHAR(255),
    descripcion TEXT,
    foto_perfil_url VARCHAR(255) NOT NULL,
    cv_pdf_url VARCHAR(255) NOT NULL,
    certificado_regular_url VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Empresas
CREATE TABLE empresas (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) UNIQUE NOT NULL,
    email_contacto VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    rubro VARCHAR(100),
    ubicacion VARCHAR(150),
    descripcion_empresa TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Ofertas Laborales
CREATE TABLE ofertas (
    id_oferta INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    carrera_objetivo VARCHAR(120) NOT NULL,
    modalidad ENUM('Presencial', 'Remoto', 'Híbrido') NOT NULL,
    tipo_puesto ENUM('Pasantía', 'Part-Time', 'Full-Time') NOT NULL,
    activa BOOLEAN DEFAULT TRUE,
    fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_oferta_empresa FOREIGN KEY (id_empresa) 
        REFERENCES empresas(id_empresa) ON DELETE CASCADE
);

-- 5. Tabla de Postulaciones (Con indicador de lectura por la empresa)
CREATE TABLE postulaciones (
    id_postulacion INT AUTO_INCREMENT PRIMARY KEY,
    id_oferta INT NOT NULL,
    id_estudiante INT NOT NULL,
    estado ENUM('Pendiente', 'En revisión', 'Entrevista', 'Rechazado', 'Aceptado') DEFAULT 'Pendiente',
    leido_por_empresa BOOLEAN DEFAULT FALSE,
    fecha_lectura TIMESTAMP NULL,
    fecha_postulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_postulacion_oferta FOREIGN KEY (id_oferta) 
        REFERENCES ofertas(id_oferta) ON DELETE CASCADE,
    CONSTRAINT fk_postulacion_estudiante FOREIGN KEY (id_estudiante) 
        REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE,
    UNIQUE KEY uk_postulacion_unica (id_oferta, id_estudiante)
);

-- 6. Tabla de Mensajes (Chat bidireccional Estudiante <-> Empresa)
CREATE TABLE mensajes (
    id_mensaje INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_empresa INT NOT NULL,
    remitente ENUM('estudiante', 'empresa') NOT NULL,
    contenido TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_estudiante FOREIGN KEY (id_estudiante) 
        REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE,
    CONSTRAINT fk_msg_empresa FOREIGN KEY (id_empresa) 
        REFERENCES empresas(id_empresa) ON DELETE CASCADE
);

ALTER TABLE empresas ADD COLUMN logo_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE estudiantes
ADD COLUMN password VARCHAR(255) NOT NULL;

ALTER TABLE empresas
ADD COLUMN password VARCHAR(255) NOT NULL;

ALTER Table empresas
add COLUMN descripcion_empresa VARCHAR(255) NOT NULL;