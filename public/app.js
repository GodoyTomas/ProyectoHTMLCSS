const contenedorOfertas = document.getElementById('contenedorOfertas');
const inputCarrera = document.getElementById('filtroCarrera');
const selectModalidad = document.getElementById('filtroModalidad');
const btnBuscar = document.getElementById('btnBuscar');

async function cargarOfertas() {
    const carrera = inputCarrera.value.trim();
    const modalidad = selectModalidad.value;

    const params = new URLSearchParams();
    if (carrera) params.append('carrera', carrera);
    if (modalidad) params.append('modalidad', modalidad);

    try {
        const respuesta = await fetch(`/api/ofertas?${params.toString()}`);
        const ofertas = await respuesta.json();

        contenedorOfertas.innerHTML = '';

        if (ofertas.length === 0) {
            contenedorOfertas.innerHTML = '<p>No se encontraron ofertas con esos criterios.</p>';
            return;
        }

        ofertas.forEach(oferta => {
            const card = document.createElement('article');
            card.className = 'card-oferta';
            card.innerHTML = `
                <div>
                    <h3>${oferta.titulo}</h3>
                    <p class="empresa">${oferta.empresa} — ${oferta.ubicacion}</p>
                    <p>${oferta.descripcion}</p>
                    <div class="badges">
                        <span class="badge">🎓 ${oferta.carrera_objetivo}</span>
                        <span class="badge">📍 ${oferta.modalidad}</span>
                        <span class="badge">⏱️ ${oferta.tipo_puesto}</span>
                    </div>
                </div>
                <button class="btn-postular" onclick="postular(${oferta.id_oferta})">Postularme</button>
            `;
            contenedorOfertas.appendChild(card);
        });
    } catch (error) {
        console.error('Error cargando ofertas:', error);
        contenedorOfertas.innerHTML = '<p>Error al conectar con el servidor.</p>';
    }
}

function postular(idOferta) {
    alert(`Función de postulación para la oferta #${idOferta} lista para vincular con sesión de estudiante.`);
}

btnBuscar.addEventListener('click', cargarOfertas);
document.addEventListener('DOMContentLoaded', cargarOfertas);