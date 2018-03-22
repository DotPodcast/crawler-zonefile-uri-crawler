## Zonefile URI Crawler

This is one component of the scraping architecture. For an overview of
the entire crawler, see [dotpodcast-crawler](https://github.com/DotPodcast/dotpodcast-crawler)

Currently, this component:

1. Takes a URI to a `head.json` or `feed.json` off of RabbitMQ
1. Gets the contents of that file via an HTTP GET call
1. Sends podcast data or each episode individually to the persistence queue
1. If the item requested was a podcast, push a message on the URI crawl queue to crawl the episode list
1. If the item request was an episode, push a message on the URI crawl queue to crawl the next page of the episode list

### Setup
Install app dependencies with:
```
yarn
```

or
```
npm install
```

Then, make sure you have a RabbitMQ instance available.
Since multiple parts of this scraping system rely on RabbitMQ, I'd
recommend spinning one up and pointing all projects to it. The
`docker-compose.yml` with RabbitMQ and Elasticsearch we use to run the
crawler locally can be found in the [dotpodcast-crawler](https://github.com/DotPodcast/dotpodcast-crawler)
repository.

If you already have one running, ensure that the
rabbit host/exchange are configured properly in `config.json`.

Run the app with:
```
yarn run dev
```
or
```
npm run dev
```
