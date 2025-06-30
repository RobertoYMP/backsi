const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verificarToken, SECRET } = require('../middleware/auth'); // <-- Cambié auth por verificarToken

// Registro de usuario
router.post('/', async (req, res) => {
  const { correo, contrasena, rol } = req.body;
  if (!correo || !contrasena || !rol) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    const hash = await bcrypt.hash(contrasena, 10);
    const result = await db.query(
      'INSERT INTO Usuario (correo, contrasena, rol) VALUES ($1, $2, $3) RETURNING id_usuario, correo, rol',
      [correo, hash, rol]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'El correo ya está registrado' });
    } else {
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    const result = await db.query(
      'SELECT id_usuario, correo, contrasena, rol FROM Usuario WHERE correo = $1',
      [correo]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const usuario = result.rows[0];
    const match = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    // Generar JWT
    const token = jwt.sign({ id_usuario: usuario.id_usuario, correo: usuario.correo, rol: usuario.rol }, SECRET, { expiresIn: '8h' });
    res.json({ id_usuario: usuario.id_usuario, correo: usuario.correo, rol: usuario.rol, token });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.get('/estado-proceso', verificarToken, async (req, res) => { // <-- Cambié auth por verificarToken
  try {
    const id_usuario = req.user.id_usuario;

    // 1. Solicitud
    const solicitudResult = await db.query(
      'SELECT * FROM Solicitud WHERE id_usuario = $1 ORDER BY id_solicitud DESC LIMIT 1',
      [id_usuario]
    );
    const solicitud = solicitudResult.rows[0];

    // 2. Documentos
    let documentos = [];
    if (solicitud) {
      const documentosResult = await db.query(
        'SELECT * FROM Documento WHERE id_solicitud = $1',
        [solicitud.id_solicitud]
      );
      documentos = documentosResult.rows;
    }

    // 3. Pago
    let pago = null;
    if (solicitud) {
      const pagoResult = await db.query(
        'SELECT * FROM Pago WHERE id_solicitud = $1 ORDER BY id_pago DESC LIMIT 1',
        [solicitud.id_solicitud]
      );
      pago = pagoResult.rows[0] || null;
    }

    // 4. Asignación de casillero
    let casillero = null;
    if (pago) {
      const asignacionResult = await db.query(
        `SELECT a.*, c.numero, c.ubicacion 
         FROM AsignacionCasillero a
         JOIN Casillero c ON a.id_casillero = c.id_casillero
         WHERE a.id_pago = $1
         ORDER BY a.id_asignacion DESC LIMIT 1`,
        [pago.id_pago]
      );
      if (asignacionResult.rows.length > 0) {
        casillero = asignacionResult.rows[0];
      }
    }

    res.json({
      solicitud,
      documentos,
      pago,
      casillero
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el estado del proceso' });
  }
});

// Endpoint robusto: si el usuario existe pero no tiene solicitud, devuelve estado vacío
router.get('/estado-proceso/:id_usuario', verificarToken, async (req, res) => {
  try {
    const { id_usuario } = req.params;
    // Verifica si el usuario existe
    const usuarioResult = await db.query('SELECT * FROM Usuario WHERE id_usuario = $1', [id_usuario]);
    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // 1. Solicitud
    const solicitudResult = await db.query(
      'SELECT * FROM Solicitud WHERE id_usuario = $1 ORDER BY id_solicitud DESC LIMIT 1',
      [id_usuario]
    );
    const solicitud = solicitudResult.rows[0];
    // 2. Documentos
    let documentos = [];
    if (solicitud) {
      const documentosResult = await db.query(
        'SELECT * FROM Documento WHERE id_solicitud = $1',
        [solicitud.id_solicitud]
      );
      documentos = documentosResult.rows;
    }
    // 3. Pago
    let pago = null;
    if (solicitud) {
      const pagoResult = await db.query(
        'SELECT * FROM Pago WHERE id_solicitud = $1 ORDER BY id_pago DESC LIMIT 1',
        [solicitud.id_solicitud]
      );
      pago = pagoResult.rows[0] || null;
    }
    // 4. Asignación de casillero
    let casillero = null;
    if (pago) {
      const asignacionResult = await db.query(
        `SELECT a.*, c.numero, c.ubicacion 
         FROM AsignacionCasillero a
         JOIN Casillero c ON a.id_casillero = c.id_casillero
         WHERE a.id_pago = $1
         ORDER BY a.id_asignacion DESC LIMIT 1`,
        [pago.id_pago]
      );
      if (asignacionResult.rows.length > 0) {
        casillero = asignacionResult.rows[0];
      }
    }
    res.json({
      solicitud: solicitud || null,
      documentos,
      pago,
      casillero
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el estado del proceso' });
  }
});

module.exports = router;
