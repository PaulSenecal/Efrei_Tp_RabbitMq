const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

// URL de connexion à RabbitMQ avec identifiants guest
const rabbitMQUrl = 'amqp://guest:guest@localhost';

// Nom de l'échange
const exchange = 'direct_logs';

// Utiliser bodyParser pour parser les requêtes JSON
app.use(bodyParser.json());

// Servir le fichier HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Servir le fichier HTML pour user2
app.get('/user2', (req, res) => {
  res.sendFile(__dirname + '/user2.html');
});

// WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
});

// Fonction pour envoyer un message à RabbitMQ
async function sendMessage(msg, routingKey) {
  try {
    // Connexion à RabbitMQ
    const connection = await amqp.connect(rabbitMQUrl);
    const channel = await connection.createChannel();

    // Déclarer l'échange de type direct
    await channel.assertExchange(exchange, 'direct', {
      durable: false
    });

    // Envoyer le message à l'échange avec la clé de routage
    channel.publish(exchange, routingKey, Buffer.from(msg));
    console.log(`Message sent to ${routingKey}: ${msg}`);

    // Fermer la connexion
    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Endpoint pour envoyer un message à user2
app.post('/send', async (req, res) => {
  const message = req.body.message;
  sendMessage(message, 'user2');
  res.json({ message: `Message "${message}" sent to user2` });
});

// Endpoint pour que user2 envoie un message à guest
app.post('/sendToGuest', async (req, res) => {
  const message = req.body.message;
  sendMessage(message, 'guest');
  res.json({ message: `Message "${message}" sent to guest` });
});

// Fonction pour recevoir les messages de RabbitMQ et les diffuser aux clients WebSocket
async function receiveMessages() {
  try {
    // Connexion à RabbitMQ
    const connection = await amqp.connect(rabbitMQUrl);
    const channel = await connection.createChannel();

    // Déclarer l'échange de type direct
    await channel.assertExchange(exchange, 'direct', {
      durable: false
    });

    // Déclarer une file d'attente pour recevoir les messages
    const q = await channel.assertQueue('', { exclusive: true });

    // Lier la file d'attente à l'échange avec la clé de routage
    channel.bindQueue(q.queue, exchange, 'user2');
    channel.bindQueue(q.queue, exchange, 'guest');

    console.log('Waiting for messages...');

    // Consommer les messages de la file d'attente
    channel.consume(q.queue, (msg) => {
      if (msg !== null) {
        const message = msg.content.toString();
        console.log(`Received message: ${message}`);

        // Diffuser le message aux clients WebSocket
        wss.clients.forEach((client) => {
          client.send(message);
        });

        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error receiving messages:', error);
  }
}

// Démarrer le serveur Express
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Démarrer la réception des messages de RabbitMQ
receiveMessages();
