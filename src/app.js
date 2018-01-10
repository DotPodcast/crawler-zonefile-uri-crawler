import winston from 'winston';
import amqplib from 'amqplib';
import axios from 'axios';

import config from './config';

const ZF_IDX = 'zonefiles';
const ZF_TYPE = 'zonefile';

winston.log('info', 'Up');
winston.log('info', config.get('rabbit'));

const exit = (cb) => {
  try {
    if (cb) {
      cb();
    }
  } catch (err) {
    winston.log('error', 'Could not run cleanup fn');
    winston.log('error', err);
  } finally {
    process.exit(0);
  }
};

const inQ = config.get('rabbit:inQueue');
const outQ = config.get('rabbit:outQueue');
const persistQ = config.get('rabbit:persistQueue');

// Connect to RabbitMQ
const open = amqplib.connect(`amqp://${config.get('rabbit:host')}`);

open.then((conn) => {
  conn.createChannel()
    .then((ch) => {
      ch.prefetch(1);
      ch.assertQueue(inQ, { durable: true });
      winston.log('info', 'Input Queue is Present');

      ch.assertQueue(outQ, { durable: true });
      winston.log('info', 'Output Queue is Present');

      const work = async (doc, channel, msg) => {
        if (!doc.uri) {
          winston.info(`No uris found for ${doc.$origin}`);
          return channel.ack(msg);
        }

        const httpUri = doc.uri.filter((uri) => uri.name === '_http._tcp');
        winston.info(httpUri);
        if (!httpUri.length) {
          winston.info(`No http uri found for ${doc.$origin}`);
          return channel.ack(msg);
        }

        axios.get(httpUri[0].target).then((res) => {
          if(res.status >= 200 && res.status < 300) {
            winston.info(`Got profile for ${doc.$origin}`);
            channel.sendToQueue(persistQ, Buffer.from(JSON.stringify({
              index: 'people',
              type: 'person',
              id: doc.$origin,
              source: res.data[0],
            })), { persistent: true });
          } else {
            winston.error(res.status);
          }
        }).catch((e) => {
          winston.info(`Failed to get profile for ${doc.$origin}`);
        });

        return channel.ack(msg);
        // channel.sendToQueue(outQ, Buffer.from(JSON.stringify(zonefile)), { persistent: true });
        // TODO account for multiple URIS for redundant subdomains
        // channel.ack(msg);
        // channel.sendToQueue(outQ, Buffer.from(JSON.stringify(zonefile)), { persistent: true });
        // channel.nack(msg, undefined, false);
      };

      ch.consume(inQ, (msg) => {
        let doc;
        try {
          doc = JSON.parse(msg.content.toString());
        } catch (e) {
          winston.log('error', e);
          return winston.log('error', 'Could not parse message into JSON');
        }
        return work(doc, ch, msg);
      }, { noAck: false });
    });
});

open.catch((err) => {
  winston.log('warn', `Error connecting to rabbit at ${config.get('rabbit_host')}`);
  winston.log('error', err);
  exit();
});

process.on('SIGINT', () => {
  winston.log('info', '\nGracefully shutting down from SIGINT (Ctrl-C)');
  exit();
});
