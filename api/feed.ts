import ytpl from 'ytpl'
import RSS from 'rss'
import { NowRequest, NowResponse } from '@now/node'

const ytURL = "https://handsfreeyoutube.now.sh/"

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
        regex: /ewangeliarzop|chlebak|dominikanie na niedziel/gi,
        limit: 10
    },
    {
        sourceId: 'https://www.youtube.com/user/Maskacjusz',
        regex: /Ewangelia|eCzytanie/gi,
        limit: 10
    },
    {
        sourceId: 'https://www.youtube.com/channel/UCme4ZOv65uzGADXuvtHkSvA',
        regex: /CNN|Rekolekcje/gi,
        limit: 10
    }
]

function ytGet({ sourceId, regex, limit }): Promise<Array<YtInfo>> {
    return ytpl(sourceId, { limit: limit })
        .then(info => {
            if (regex) {
                return info.items.filter(item => item.title.match(regex))
            }
            return info.items
        })
}

export const zip = sources => {
    let result = [];
    let slice;

    do {
        slice = sources.map(source => source.shift()).filter(i => i)
        result = result.concat(slice)
    } while (slice.length)

    return result;
};

//ZEIT Smart CDN should not allow this to be called more than once per hour, so no caching here
function getPlaylistItems({ selfURL }) {
    return Promise.all(sources.map(ytGet))
        .then((results) => {
            const items = zip(results);
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
                    enclosure: { url: `${ytURL}api/yt?v=${item.id}`, type: 'audio/mp4' },
                    url: `${ytURL}api/yt?v=${item.id}`,
                    custom_elements: [
                        {
                            'itunes:image': {
                                _attr: {
                                    href: item.thumbnail
                                }
                            }
                        }
                    ]
                })
            })

            return feed.xml();
        })
}

export default (req: NowRequest, res: NowResponse) => {
    const selfURL = `https://${req.headers.host}/`

    return getPlaylistItems({ selfURL }).then(feedXML => {
        res.setHeader('content-type', 'application/rss+xml')
        res.setHeader('cache-control', 's-maxage=3600')
        res.send(feedXML)
    })
}
