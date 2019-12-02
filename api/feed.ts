import ytpl from 'ytpl'
import RSS from 'rss'
import { NowRequest, NowResponse } from '@now/node'

type YtInfo = {
    id: string;
    url: string;
    url_simple: string;
    title: string;
    thumbnail: string;
    duration: string;
    author: {
        id: string;
        name: string;
        user: string;
        channel_url: string;
        user_url: string;
    };
}

const sources = [
    {
        sourceId: 'https://www.youtube.com/channel/UCLlzlc4XSItHVTcMnrIlv1w',
        regex: /ewangeliarzop|chlebak|dominikanie na niedziel|poczekalnia/gi,
        limit: 10
    },
    {
        sourceId: 'PLFn1VIsptN2J2682cVnbQ39SOuiUgt3u4',
        limit: 2
    },
    {
        sourceId: 'PLFn1VIsptN2L2CEJAFV9udicClIF2myUf',
        limit: 2
    },
    {
        sourceId: 'PLFn1VIsptN2LGrFYKkOqOQL2yhGoP4xV8',
        limit: 2
    },
    {
        sourceId: 'https://www.youtube.com/channel/UCme4ZOv65uzGADXuvtHkSvA',
        regex: /CNN|Ogrody/gi,
        limit: 10
    }
]

function ytGet({ sourceId, regex, limit }): Promise<Array<YtInfo>> {
    return ytpl(sourceId, { limit: limit })
        // .then(a => { console.log(a); return a })
        .then(info => {
            if (regex) {
                return info.items.filter(item => item.title.match(regex))
            }
            return info.items
        })
}

const flatten = arr => [].concat(...arr);

//ZEIT Smart CDN should not allow this to be called more than once per hour, so no caching here
function getPlaylistItems({ selfURL }) {
    return Promise.all(sources.map(ytGet))
        .then((results) => {
            const items = flatten(results);
            let feed = new RSS({
                title: 'Czytanie z komentarzem',
                description: 'Czytanie z MaskacjuszTV, komentarze z Dominikanie.pl',
                feed_url: `${selfURL}api/feed`,
                ttl: '60',
                custom_namespaces: {
                    'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd'
                },
                custom_elements: [
                    //TODO add more podcast specific info
                ]
            })

            items.forEach(item => {
                feed.item({
                    title: item.title,
                    enclosure: { url: `${selfURL}api/yt?v=${item.id}`, type: 'audio/mp4', length: human2seconds(item.duration) },
                    url: `${selfURL}api/yt?v=${item.id}`,
                })
            })

            return feed.xml();
        })
}

function human2seconds(duration: string): number {
    // TODO: turn stuff like 4:55 into seconds
    return 123
}

export default (req: NowRequest, res: NowResponse) => {
    const selfURL = `https://${req.headers.host}/`

    return getPlaylistItems({ selfURL }).then(feedXML => {
        res.setHeader('content-type', 'application/rss+xml')
        res.setHeader('cache-control', 's-maxage=3600')
        res.send(feedXML)
    })
}
