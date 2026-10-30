-- 1. Tabla de Estudiantes (Con todos los datos personales, redes y los 3 archivos)
CREATE TABLE IF NOT EXISTS estudiantes (
    id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    institucion VARCHAR(150) NOT NULL,
    carrera VARCHAR(120) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(50) NOT NULL,
    linkedin_url VARCHAR(255),
    github_portfolio_url VARCHAR(255),
    instagram_url VARCHAR(255),
    descripcion TEXT,
    foto_perfil_url VARCHAR(255) NOT NULL,         -- Ruta al archivo .jpg o .png
    cv_pdf_url VARCHAR(255) NOT NULL,              -- Ruta al archivo .pdf
    certificado_regular_url VARCHAR(255) NOT NULL, -- Ruta al certificado (cualquier formato)
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Empresas (Para quienes publican ofertas o buscan estudiantes)
CREATE TABLE IF NOT EXISTS empresas (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) UNIQUE NOT NULL,
    email_contacto VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    rubro VARCHAR(100),
    ubicacion VARCHAR(150),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Ofertas Laborales / Pasantías
CREATE TABLE IF NOT EXISTS ofertas (
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

-- 4. Tabla Intermedia de Postulaciones (Vincula al Estudiante con la Oferta)
CREATE TABLE IF NOT EXISTS postulaciones (
    id_postulacion INT AUTO_INCREMENT PRIMARY KEY,
    id_oferta INT NOT NULL,
    id_estudiante INT NOT NULL,
    estado ENUM('Pendiente', 'En revisión', 'Entrevista', 'Rechazado', 'Aceptado') DEFAULT 'Pendiente',
    fecha_postulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_postulacion_oferta FOREIGN KEY (id_oferta) 
        REFERENCES ofertas(id_oferta) ON DELETE CASCADE,
    CONSTRAINT fk_postulacion_estudiante FOREIGN KEY (id_estudiante) 
        REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE,
    UNIQUE KEY uk_postulacion_unica (id_oferta, id_estudiante)
);

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS postulaciones;
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS empresas;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE empresas (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) UNIQUE NOT NULL,
    email_contacto VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    rubro VARCHAR(100),
    ubicacion VARCHAR(150),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE postulaciones (
    id_postulacion INT AUTO_INCREMENT PRIMARY KEY,
    id_oferta INT NOT NULL,
    id_estudiante INT NOT NULL,
    estado ENUM('Pendiente', 'En revisión', 'Entrevista', 'Rechazado', 'Aceptado') DEFAULT 'Pendiente',
    fecha_postulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_postulacion_oferta FOREIGN KEY (id_oferta) 
        REFERENCES ofertas(id_oferta) ON DELETE CASCADE,
    CONSTRAINT fk_postulacion_estudiante FOREIGN KEY (id_estudiante) 
        REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE,
    UNIQUE KEY uk_postulacion_unica (id_oferta, id_estudiante)
);