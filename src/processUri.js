import winston from 'winston';
import axios from 'axios';
import config from './config';
import processTaxonomies from './processTaxonomies';

const inQ = config.get('rabbit:inQueue');
const persistQ = config.get('rabbit:persistQueue');

const isPodcastHeader = json => !!json.items_url;
const isEpisodeFeedPage = json => !!json.items;
const isUser = json => json.length && json[0] && json[0].token;

const getNextPage = (json) => {
  if (json.meta && json.meta.next_url) {
    return json.meta.next_url;
  }
  return undefined;
};

const work = async (doc, channel, msg) => {
  try {
    const res = await axios.get(doc.uri);
    if (res.status >= 200 && res.status < 300) {
      winston.info(`Got file at ${doc.uri}`);

      const mergeData = doc.mergeData || {};
      const data = { ...mergeData, ...res.data };
      let index;
      let type;
      let id;

      if (isEpisodeFeedPage(data)) {
        index = 'episodes';
        type = 'episode';
      } else if (isPodcastHeader(data)) {
        index = 'podcasts';
        type = 'podcast';
        id = doc.mergeData.docId;
        data.taxonomy_hierarchy = processTaxonomies(data);
      } else if (isUser(data)) {
        index = 'people';
        type = 'person';
        id = doc.mergeData.docId;
      } else {
        winston.error(`Unidentifiable document at ${doc.uri}`);
        return channel.ack(msg);
      }


      if (isPodcastHeader(data) || isUser(data)) {
        channel.sendToQueue(persistQ, Buffer.from(JSON.stringify({
          index,
          type,
          id,
          source: data,
        })), { persistent: true });
      } else if (isEpisodeFeedPage(data)) {
        data.items.forEach((item) => {
          channel.sendToQueue(persistQ, Buffer.from(JSON.stringify({
            index,
            type,
            id: item.id,
            source: { ...mergeData, ...item },
          })), { persistent: true });
        });
      }


      if (isPodcastHeader(data)) {
        channel.sendToQueue(inQ, Buffer.from(JSON.stringify({
          uri: data.items_url,
          mergeData: {
            podcast: data,
          },
        })), { persistent: true });
      } else if (isEpisodeFeedPage(data) && getNextPage(data)) {
        channel.sendToQueue(inQ, Buffer.from(JSON.stringify({
          uri: getNextPage(data),
          mergeData: doc.mergeData,
        })), { persistent: true });
      }
    } else {
      winston.error(`Got error code when requesting uri at ${doc.uri}`);
    }
  } catch (e) {
    winston.info(`Failed to get data for ${doc.uri}`);
  }

  return channel.ack(msg);
};

export default work;
