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


const plCzytanie = 'PLFn1VIsptN2J2682cVnbQ39SOuiUgt3u4'
const plChlebak = 'PLRSGEZKuzW-5VWfGU8FuYTNV1rd6p7-7C'
const plEwangeliarz = 'PLRSGEZKuzW-6-jQIswd49mjBLqpiKJpsF'
const plCNN = 'PLVdrvbY9AVQrHZyAaXHTJf4d4yVXCGAqq'

function ytGetPlaylistFirst2(playlist: string): Promise<Array<YtInfo>> {
    return ytpl(playlist, { limit: 2 }).then(info => info.items)
}
function ytGetPlaylistLast(playlist: string): Promise<YtInfo> {
    return ytpl(playlist, { limit: 0 }).then(info => info.items[info.items.length - 1])
}
function ytGetPlaylistGuess(playlist: string): Promise<YtInfo> {
    return ytpl(playlist, { limit: 0 }).then(info => {
        const last = info.items[info.items.length - 1]
        const first = info.items[0]
        const firstMatch = first.title.match(/([0-9]+)/g)
        const lastMatch = last.title.match(/([0-9]+)/g)
        // console.log(first.title, firstMatch, parseInt(firstMatch[0], 10), last.title, lastMatch, parseInt(lastMatch[0], 10))
        if (parseInt(firstMatch[0], 10) < parseInt(lastMatch[0], 10)) {
            return last
        } else {
            return first
        }
    })
}

//ZEIT Smart CDN should not allow this to be called more than once per hour, so no caching here
function getPlaylistItems({ selfURL }) {
    return Promise.all([
        ytGetPlaylistFirst2(plCzytanie),
        ytGetPlaylistGuess(plChlebak),
        ytGetPlaylistLast(plEwangeliarz),
        ytGetPlaylistGuess(plCNN)
    ])
        .then(([items, ...moreItems]) => {
            items = items.concat(moreItems)
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
        res.setHeader('cache-control', 'max-age=3600, stale-while-revalidate')
        res.send(feedXML)
    })
}
