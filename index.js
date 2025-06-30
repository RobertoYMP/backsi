require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger/swagger.json');
const db = require('./db');
const fileUpload = require('express-fileupload');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas principales (se agregarán después)
app.use('/usuarios', require('./routes/usuarios'));
app.use('/solicitudes', require('./routes/solicitudes'));
app.use('/documentos', require('./routes/documentos'));
app.use('/casilleros', require('./routes/casilleros'));
app.use('/pagos', fileUpload(), require('./routes/pagos'));
app.use('/asignaciones', require('./routes/asignaciones'));

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
