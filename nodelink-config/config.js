export default {
  server: {
    host: '0.0.0.0',
    port: 2333,
    password: 'nodelink-internal',
    useBunServer: true,
  },
  cluster: {
    enabled: false,
  },
  logging: {
    level: 'info',
    file: {
      enabled: false,
      path: 'logs',
      rotation: 'daily',
      ttlDays: 7,
    },
    debug: {
      all: false,
      request: false,
      session: false,
      player: false,
      filters: false,
      sources: false,
      lyrics: false,
      youtube: false,
      'youtube-cipher': false,
    },
  },
  maxSearchResults: 10,
  maxAlbumPlaylistLength: 100,
  playerUpdateInterval: 2000,
  statsUpdateInterval: 30000,
  trackStuckThresholdMs: 10000,
  eventTimeoutMs: 15000,
  zombieThresholdMs: 60000,
  enableHoloTracks: false,
  enableTrackStreamEndpoint: false,
  enableLoadStreamEndpoint: false,
  resolveExternalLinks: false,
  fetchChannelInfo: false,
  audio: {
    quality: 'high',
    encryption: 'aead_aes256_gcm_rtpsize',
    resamplingQuality: 'best',
    loudnessNormalizer: false,
    lookaheadMs: 5,
    gateThresholdLUFS: -60,
  },
  sources: {
    youtube: {
      enabled: true,
      allowItag: [], // additional itags for audio streams, e.g., [140, 141]
      targetItag: null, // force a specific itag for audio streams, overriding the quality option
      getOAuthToken: false,
      hl: 'en',
      gl: 'US',
      clients: {
        search: ['Android'], // Clients used for searching tracks
        playback: ['AndroidVR', 'TV', 'TVCast', 'WebEmbedded', 'WebParentTools', 'Web', 'IOS'], // Clients used for playback/streaming
        resolve: ['AndroidVR', 'TV', 'TVCast', 'WebEmbedded', 'WebParentTools', 'IOS', 'Web'], // Clients used for resolving detailed track information (channel, external links, etc.)
        settings: {
          TV: {
            refreshToken: [''], // You can use a string "token" or an array ["token1", "token2"] for rotation/fallback
          },
        },
      },
      cipher: {
        url: 'https://cipher.kikkia.dev/api',
        token: null,
      },
    },
    soundcloud: {
      enabled: false,
    },
    spotify: {
      enabled: false,
    },
    applemusic: {
      enabled: false,
    },
    deezer: {
      enabled: false,
    },
    bandcamp: {
      enabled: false,
    },
    local: {
      enabled: false,
    },
    http: {
      enabled: false,
    },
    vkmusic: {
      enabled: false,
    },
    amazonmusic: {
      enabled: false,
    },
    bluesky: {
      enabled: false,
    },
    anghami: {
      enabled: false,
    },
    rss: {
      enabled: false,
    },
    songlink: {
      enabled: false,
    },
    mixcloud: {
      enabled: false,
    },
    audiomack: {
      enabled: false,
    },
    eternalbox: {
      enabled: false,
    },
    vimeo: {
      enabled: false,
    },
    iheartradio: {
      enabled: false,
    },
    telegram: {
      enabled: false,
    },
    shazam: {
      enabled: false,
    },
    bilibili: {
      enabled: false,
    },
    genius: {
      enabled: false,
    },
    pinterest: {
      enabled: false,
    },
    flowery: {
      enabled: false,
    },
    lazypytts: {
      enabled: false,
    },
    jiosaavn: {
      enabled: false,
    },
    gaana: {
      enabled: false,
    },
    'google-tts': {
      enabled: false,
    },
    pipertts: {
      enabled: false,
    },
    instagram: {
      enabled: false,
    },
    kwai: {
      enabled: false,
    },
    twitch: {
      enabled: false,
    },
    audius: {
      enabled: false,
    },
    tidal: {
      enabled: false,
    },
    pandora: {
      enabled: false,
    },
    nicovideo: {
      enabled: false,
    },
    reddit: {
      enabled: false,
    },
    tumblr: {
      enabled: false,
    },
    twitter: {
      enabled: false,
    },
    qobuz: {
      enabled: false,
    },
    lastfm: {
      enabled: false,
    },
    netease: {
      enabled: false,
    },
    letrasmus: {
      enabled: false,
    },
    yandexmusic: {
      enabled: false,
    },
    monochrome: {
      enabled: false,
    },
  },
  defaultSearchSource: ['youtube'],
  unifiedSearchSources: ['youtube'],
};
