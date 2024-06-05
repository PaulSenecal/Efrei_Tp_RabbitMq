const amqp = require('amqplib');

// URL de connexion à RabbitMQ avec identifiants guest
const rabbitMQUrl = 'amqp://guest:guest@localhost';

// Nom de l'échange
const exchange = 'direct_logs';

// Clé de routage pour l'utilisateur user2
const routingKey = 'user2';

// Fonction pour envoyer un message à RabbitMQ
async function sendMessage(msg) {
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

// Fonction pour recevoir des messages pour user2 de RabbitMQ
async function receiveMessages(user) {
  try {
    // Connexion à RabbitMQ
    const connection = await amqp.connect(rabbitMQUrl);
    const channel = await connection.createChannel();

    // Déclarer l'échange de type direct
    await channel.assertExchange(exchange, 'direct', {
      durable: false
    });

    // Déclarer une file d'attente pour l'utilisateur
    const q = await channel.assertQueue(user, {
      exclusive: false
    });

    // Lier la file d'attente à l'échange avec la clé de routage
    await channel.bindQueue(q.queue, exchange, user);

    console.log(`Waiting for messages for ${user}...`);

    // Consommer les messages de la file d'attente
    channel.consume(q.queue, (msg) => {
      if (msg !== null) {
        console.log(`Received message for ${user}: ${msg.content.toString()}`);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error receiving messages:', error);
  }
}

// Exemple d'envoi de message à user2
sendMessage('Hello, user2!');

// Exemple de réception de messages pour user2
receiveMessages('user2');
