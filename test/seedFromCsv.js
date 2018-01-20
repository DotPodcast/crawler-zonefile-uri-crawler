import winston from 'winston';
import amqplib from 'amqplib';
import fs from 'fs';
import path from 'path';
import parse from 'csv-parse';
import config from '../src/config';

winston.log('info', 'Up');
winston.log('info', config.get('rabbit'));

const inQ = config.get('rabbit:inQueue');

// Connect to RabbitMQ
const open = amqplib.connect(`amqp://${config.get('rabbit:host')}`);

open.then((conn) => {
  conn.createChannel()
    .then((ch) => {
      ch.assertQueue(inQ, { durable: true });
      winston.log('info', 'Input Queue is Present');

      const parser = parse();
      parser.on('readable', () => {
        let record;
        while (record = parser.read()) {
          const msg = {
            uri: `http://dotpodcast-pseudo-web-d5clkna-1128393060.us-east-1.elb.amazonaws.com/${record[2]}/head.json`,
            mergeData: {
              docId: `${record[2]}.verified.podcast`,
            },
          };
          winston.info(msg);
          ch.sendToQueue(inQ, Buffer.from(JSON.stringify(msg)), { persistent: true });
        }
      });

      fs.createReadStream(path.join(__dirname, './fixtures/half-pruned.csv')).pipe(parser);

      setTimeout(() => process.exit(), 2000);
    });
});
