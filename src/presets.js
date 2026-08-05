// The size catalogue.
//
// `keywords` is the whole trick. People do not search for "Instagram Portrait Post" — 
// they search for "ig tall", "4x5", "the one that takes up more feed", "pfp", "thumbnail".
// Every way a marketer, developer, or creator might query a size lives here.

export const PRESETS = [
  // ==========================================
  // ---- INSTAGRAM ----
  // ==========================================
  { id: 'ig-square', group: 'Instagram', name: 'Square post', w: 1080, h: 1080, hot: true,
    keywords: ['ig', 'insta', 'instagram', 'square', 'feed', '1:1', '1x1', 'grid', 'carousel', 'post'] },
  { id: 'ig-portrait', group: 'Instagram', name: 'Portrait post', w: 1080, h: 1350, hot: true,
    keywords: ['ig', 'insta', 'instagram', 'tall', 'portrait', 'vertical', '4:5', '4x5', 'feed', 'carousel', 'biggest', 'more feed', 'takes up feed', 'optimum feed'] },
  { id: 'ig-landscape', group: 'Instagram', name: 'Landscape post', w: 1080, h: 566,
    keywords: ['ig', 'insta', 'instagram', 'wide', 'landscape', 'horizontal', 'feed', '1.91:1'] },
  { id: 'ig-story', group: 'Instagram', name: 'Story / Reel', w: 1080, h: 1920, hot: true,
    keywords: ['ig', 'insta', 'instagram', 'story', 'stories', 'reel', 'reels', 'vertical', 'fullscreen', 'full screen', '9:16', '9x16', 'phone', 'video'] },
  { id: 'ig-profile', group: 'Instagram', name: 'Profile picture', w: 320, h: 320,
    keywords: ['ig', 'insta', 'instagram', 'profile', 'avatar', 'pfp', 'headshot', 'dp', 'icon', 'account photo'] },
  { id: 'ig-highlight', group: 'Instagram', name: 'Highlight cover', w: 1080, h: 1920,
    keywords: ['ig', 'insta', 'instagram', 'highlight', 'cover', 'story highlight', 'icon cover'] },
  { id: 'ig-broadcast', group: 'Instagram', name: 'Broadcast channel header', w: 1080, h: 600,
    keywords: ['ig', 'insta', 'instagram', 'broadcast', 'channel', 'header', 'banner'] },
  { id: 'ig-grid-3x1', group: 'Instagram', name: 'Grid banner (3x1)', w: 3240, h: 1080,
    keywords: ['ig', 'insta', 'instagram', 'grid', 'banner', '3x1', 'triple post', 'panoramic'] },

  // ==========================================
  // ---- TIKTOK ----
  // ==========================================
  { id: 'tiktok-video', group: 'TikTok', name: 'Vertical video / Cover', w: 1080, h: 1920, hot: true,
    keywords: ['tiktok', 'tik tok', 'video', 'vertical', 'fullscreen', '9:16', '9x16', 'cover', 'shorts', 'tok', 'feed'] },
  { id: 'tiktok-photo', group: 'TikTok', name: 'Photo mode / Carousel', w: 1080, h: 1440, hot: true,
    keywords: ['tiktok', 'tik tok', 'photo mode', 'carousel', '3:4', '3x4', 'slideshow', 'image post'] },
  { id: 'tiktok-profile', group: 'TikTok', name: 'Profile picture', w: 200, h: 200,
    keywords: ['tiktok', 'tik tok', 'profile', 'avatar', 'pfp', 'dp', 'icon'] },
  { id: 'tiktok-series', group: 'TikTok', name: 'Series cover', w: 1080, h: 1440,
    keywords: ['tiktok', 'tik tok', 'series', 'paywall', 'cover', 'course cover'] },
  { id: 'tiktok-live-cover', group: 'TikTok', name: 'LIVE event cover', w: 1080, h: 1080,
    keywords: ['tiktok', 'tik tok', 'live', 'event', 'stream', 'cover'] },

  // ==========================================
  // ---- FACEBOOK ----
  // ==========================================
  { id: 'fb-feed', group: 'Facebook', name: 'Feed / Shared link', w: 1200, h: 630, hot: true,
    keywords: ['fb', 'facebook', 'feed', 'link', 'shared link', 'share', 'post', 'meta', '1.91:1'] },
  { id: 'fb-square', group: 'Facebook', name: 'Square post', w: 1080, h: 1080,
    keywords: ['fb', 'facebook', 'square', 'post', 'feed', '1:1'] },
  { id: 'fb-story', group: 'Facebook', name: 'Story / Reel', w: 1080, h: 1920,
    keywords: ['fb', 'facebook', 'story', 'stories', 'reel', 'vertical', '9:16'] },
  { id: 'fb-cover', group: 'Facebook', name: 'Personal profile cover', w: 851, h: 315,
    keywords: ['fb', 'facebook', 'cover', 'banner', 'header', 'profile header'] },
  { id: 'fb-page-cover', group: 'Facebook', name: 'Business page cover', w: 820, h: 312,
    keywords: ['fb', 'facebook', 'page', 'business', 'cover', 'banner', 'header'] },
  { id: 'fb-group-cover', group: 'Facebook', name: 'Group banner', w: 1640, h: 856, hot: true,
    keywords: ['fb', 'facebook', 'group', 'cover', 'banner', 'header', 'community'] },
  { id: 'fb-event', group: 'Facebook', name: 'Event cover', w: 1920, h: 1005,
    keywords: ['fb', 'facebook', 'event', 'cover', 'banner', 'header'] },
  { id: 'fb-profile', group: 'Facebook', name: 'Profile photo', w: 320, h: 320,
    keywords: ['fb', 'facebook', 'profile', 'avatar', 'pfp', 'dp'] },
  { id: 'fb-marketplace', group: 'Facebook', name: 'Marketplace listing', w: 1024, h: 1024,
    keywords: ['fb', 'facebook', 'marketplace', 'listing', 'item photo', 'sell', 'square'] },

  // ==========================================
  // ---- X / TWITTER ----
  // ==========================================
  { id: 'x-post', group: 'X / Twitter', name: 'Post image (16:9)', w: 1600, h: 900, hot: true,
    keywords: ['x', 'twitter', 'tweet', 'post', 'timeline', 'card', '16:9', '16x9', 'landscape'] },
  { id: 'x-square', group: 'X / Twitter', name: 'Square post', w: 1080, h: 1080,
    keywords: ['x', 'twitter', 'tweet', 'square', 'post', '1:1'] },
  { id: 'x-header', group: 'X / Twitter', name: 'Profile header', w: 1500, h: 500, hot: true,
    keywords: ['x', 'twitter', 'header', 'banner', 'cover', 'profile banner', '3:1'] },
  { id: 'x-profile', group: 'X / Twitter', name: 'Profile picture', w: 400, h: 400,
    keywords: ['x', 'twitter', 'profile', 'avatar', 'pfp', 'icon', 'dp'] },
  { id: 'x-card-summary', group: 'X / Twitter', name: 'Summary card thumbnail', w: 240, h: 240,
    keywords: ['x', 'twitter', 'summary card', 'thumbnail', 'link icon', 'meta'] },

  // ==========================================
  // ---- LINKEDIN ----
  // ==========================================
  { id: 'li-post', group: 'LinkedIn', name: 'Feed post (1.91:1)', w: 1200, h: 627,
    keywords: ['linkedin', 'li', 'post', 'feed', 'share', 'link', 'landscape'] },
  { id: 'li-square', group: 'LinkedIn', name: 'Square post', w: 1080, h: 1080,
    keywords: ['linkedin', 'li', 'square', 'post', '1:1'] },
  { id: 'li-portrait', group: 'LinkedIn', name: 'Carousel / Document PDF', w: 1080, h: 1350, hot: true,
    keywords: ['linkedin', 'li', 'carousel', 'pdf', 'document', 'tall', 'portrait', '4:5', '4x5', 'slides', 'swipe'] },
  { id: 'li-cover', group: 'LinkedIn', name: 'Personal profile background', w: 1584, h: 396, hot: true,
    keywords: ['linkedin', 'li', 'cover', 'banner', 'header', 'background', 'personal cover'] },
  { id: 'li-company', group: 'LinkedIn', name: 'Company page banner', w: 1128, h: 191,
    keywords: ['linkedin', 'li', 'company', 'page', 'banner', 'header', 'business cover'] },
  { id: 'li-event', group: 'LinkedIn', name: 'Event cover', w: 1600, h: 900,
    keywords: ['linkedin', 'li', 'event', 'cover', 'banner', 'header', '16:9'] },
  { id: 'li-profile', group: 'LinkedIn', name: 'Profile photo', w: 400, h: 400,
    keywords: ['linkedin', 'li', 'profile', 'headshot', 'avatar', 'pfp', 'dp'] },
  { id: 'li-article', group: 'LinkedIn', name: 'Article cover photo', w: 1280, h: 720,
    keywords: ['linkedin', 'li', 'article', 'newsletter cover', 'header', 'blog post'] },

  // ==========================================
  // ---- YOUTUBE ----
  // ==========================================
  { id: 'yt-thumb', group: 'YouTube', name: 'Video thumbnail', w: 1280, h: 720, hot: true,
    keywords: ['youtube', 'yt', 'thumb', 'thumbnail', 'video', '16:9', '16x9', 'preview', 'clickbait', 'cover', '720p'] },
  { id: 'yt-banner', group: 'YouTube', name: 'Channel banner / TV art', w: 2560, h: 1440, hot: true,
    keywords: ['youtube', 'yt', 'banner', 'channel', 'art', 'cover', 'header', 'tv banner', 'desktop banner'] },
  { id: 'yt-shorts', group: 'YouTube', name: 'Shorts', w: 1080, h: 1920, hot: true,
    keywords: ['youtube', 'yt', 'shorts', 'short', 'vertical', '9:16', '9x16', 'reel'] },
  { id: 'yt-profile', group: 'YouTube', name: 'Channel profile picture', w: 800, h: 800,
    keywords: ['youtube', 'yt', 'profile', 'avatar', 'pfp', 'channel icon', 'logo'] },
  { id: 'yt-watermark', group: 'YouTube', name: 'Video branding watermark', w: 150, h: 150,
    keywords: ['youtube', 'yt', 'watermark', 'subscribe button', 'branding icon', 'corner logo'] },
  { id: 'yt-community', group: 'YouTube', name: 'Community post', w: 1080, h: 1080,
    keywords: ['youtube', 'yt', 'community', 'post', 'square', 'tab'] },

  // ==========================================
  // ---- PINTEREST ----
  // ==========================================
  { id: 'pin-standard', group: 'Pinterest', name: 'Standard pin (2:3)', w: 1000, h: 1500, hot: true,
    keywords: ['pinterest', 'pin', 'tall', '2:3', '2x3', 'vertical', 'standard pin'] },
  { id: 'pin-square', group: 'Pinterest', name: 'Square pin', w: 1000, h: 1000,
    keywords: ['pinterest', 'pin', 'square', '1:1'] },
  { id: 'pin-long', group: 'Pinterest', name: 'Long pin / Infographic', w: 1000, h: 2100,
    keywords: ['pinterest', 'pin', 'long', 'tall', 'infographic', 'tall pin', '1:2.1'] },
  { id: 'pin-idea', group: 'Pinterest', name: 'Idea pin / Story', w: 1080, h: 1920,
    keywords: ['pinterest', 'pin', 'idea pin', 'story pin', 'vertical', '9:16', 'video pin'] },
  { id: 'pin-board', group: 'Pinterest', name: 'Board display cover', w: 600, h: 600,
    keywords: ['pinterest', 'pin', 'board', 'cover', 'display', 'album cover'] },

  // ==========================================
  // ---- TWITCH & STREAMING ----
  // ==========================================
  { id: 'twitch-offline', group: 'Twitch', name: 'Offline screen banner', w: 1920, h: 1080, hot: true,
    keywords: ['twitch', 'stream', 'offline', 'screen', 'banner', '16:9', 'overlay', 'brb screen'] },
  { id: 'twitch-banner', group: 'Twitch', name: 'Profile banner', w: 1200, h: 480,
    keywords: ['twitch', 'stream', 'header', 'banner', 'profile header'] },
  { id: 'twitch-panel', group: 'Twitch', name: 'Info panel button', w: 320, h: 160,
    keywords: ['twitch', 'stream', 'panel', 'about', 'bio', 'button', 'donate', 'specs', 'schedule'] },
  { id: 'twitch-emote', group: 'Twitch', name: 'Emote (HD)', w: 512, h: 512,
    keywords: ['twitch', 'stream', 'emote', 'emoticon', 'sub emote', 'channel emote', 'discord emote'] },
  { id: 'twitch-badge', group: 'Twitch', name: 'Subscriber badge (HD)', w: 72, h: 72,
    keywords: ['twitch', 'badge', 'sub badge', 'loyalty badge', 'bit badge'] },
  { id: 'kick-banner', group: 'Kick Streaming', name: 'Channel banner', w: 1920, h: 1080,
    keywords: ['kick', 'stream', 'streaming', 'banner', 'header', 'channel art'] },
  { id: 'kick-avatar', group: 'Kick Streaming', name: 'Profile photo', w: 512, h: 512,
    keywords: ['kick', 'profile', 'avatar', 'pfp', 'streamer logo'] },

  // ==========================================
  // ---- MESSAGING & DISCORD ----
  // ==========================================
  { id: 'discord-pfp', group: 'Discord', name: 'User avatar', w: 512, h: 512, hot: true,
    keywords: ['discord', 'pfp', 'avatar', 'profile', 'icon', 'nitro', 'user photo'] },
  { id: 'discord-banner', group: 'Discord', name: 'User Nitro banner', w: 960, h: 540, hot: true,
    keywords: ['discord', 'banner', 'profile header', 'nitro banner', '16:9'] },
  { id: 'discord-server-banner', group: 'Discord', name: 'Server banner', w: 960, h: 540,
    keywords: ['discord', 'server banner', 'header', 'community banner', 'splash'] },
  { id: 'discord-server-icon', group: 'Discord', name: 'Server icon', w: 512, h: 512,
    keywords: ['discord', 'server icon', 'guild logo', 'server avatar'] },
  { id: 'whatsapp-pfp', group: 'Messaging', name: 'WhatsApp profile photo', w: 500, h: 500,
    keywords: ['whatsapp', 'wa', 'pfp', 'avatar', 'dp', 'profile', 'icon'] },
  { id: 'whatsapp-status', group: 'Messaging', name: 'WhatsApp Status / Story', w: 1080, h: 1920,
    keywords: ['whatsapp', 'wa', 'status', 'story', 'vertical', '9:16'] },
  { id: 'telegram-pfp', group: 'Messaging', name: 'Telegram profile photo', w: 512, h: 512,
    keywords: ['telegram', 'tg', 'pfp', 'avatar', 'dp', 'profile photo'] },
  { id: 'telegram-channel', group: 'Messaging', name: 'Telegram channel cover', w: 1280, h: 720,
    keywords: ['telegram', 'tg', 'channel cover', 'banner', 'header'] },

  // ==========================================
  // ---- AUDIO & PODCASTS ----
  // ==========================================
  { id: 'podcast-cover', group: 'Audio & Podcasts', name: 'Podcast cover art', w: 3000, h: 3000, hot: true,
    keywords: ['podcast', 'pod', 'apple podcast', 'spotify podcast', 'cover', 'show art', 'album art', 'square', '3000x3000'] },
  { id: 'spotify-canvas', group: 'Audio & Podcasts', name: 'Spotify Canvas video/art', w: 1080, h: 1920, hot: true,
    keywords: ['spotify', 'canvas', 'song', 'music', 'album', 'track', 'vertical', 'loop', '9:16'] },
  { id: 'spotify-header', group: 'Audio & Podcasts', name: 'Spotify Artist header', w: 2660, h: 1140,
    keywords: ['spotify', 'artist', 'header', 'banner', 'cover', 'music artist'] },
  { id: 'spotify-playlist', group: 'Audio & Podcasts', name: 'Spotify Playlist cover', w: 300, h: 300,
    keywords: ['spotify', 'playlist', 'cover art', 'music collection', 'square'] },
  { id: 'soundcloud-banner', group: 'Audio & Podcasts', name: 'SoundCloud profile header', w: 2480, h: 520,
    keywords: ['soundcloud', 'banner', 'header', 'profile background', 'audio'] },

  // ==========================================
  // ---- WORKSPACE & CREATOR PLATFORMS ----
  // ==========================================
  { id: 'notion-cover', group: 'Workspace & Creative', name: 'Notion page cover', w: 1500, h: 600, hot: true,
    keywords: ['notion', 'page cover', 'workspace banner', 'header', 'notion header', '5:2'] },
  { id: 'zoom-background', group: 'Workspace & Creative', name: 'Zoom / Teams background', w: 1920, h: 1080, hot: true,
    keywords: ['zoom', 'teams', 'google meet', 'virtual background', 'backdrop', 'office background', '16:9'] },
  { id: 'dribbble-shot', group: 'Workspace & Creative', name: 'Dribbble shot', w: 1600, h: 1200, hot: true,
    keywords: ['dribbble', 'shot', 'portfolio', 'design post', '4:3', '4x3'] },
  { id: 'behance-cover', group: 'Workspace & Creative', name: 'Behance project cover', w: 808, h: 632,
    keywords: ['behance', 'project cover', 'portfolio thumbnail', 'case study'] },
  { id: 'figma-community', group: 'Workspace & Creative', name: 'Figma Community thumbnail', w: 1920, h: 960,
    keywords: ['figma', 'community cover', 'plugin cover', 'file cover', '2:1'] },
  { id: 'patreon-banner', group: 'Workspace & Creative', name: 'Patreon cover banner', w: 1600, h: 400,
    keywords: ['patreon', 'banner', 'cover', 'membership', 'header', '4:1'] },
  { id: 'substack-header', group: 'Workspace & Creative', name: 'Substack publication logo/header', w: 1456, h: 1048,
    keywords: ['substack', 'newsletter', 'header', 'banner', 'article cover'] },
  { id: 'medium-header', group: 'Workspace & Creative', name: 'Medium article header', w: 1200, h: 630,
    keywords: ['medium', 'blog', 'story header', 'featured image'] },

  // ==========================================
  // ---- GAMING & DISTRIBUTION ----
  // ==========================================
  { id: 'steam-capsule-main', group: 'Gaming', name: 'Steam Store main capsule', w: 1232, h: 706, hot: true,
    keywords: ['steam', 'capsule', 'store capsule', 'game cover', 'valve', 'store banner'] },
  { id: 'steam-capsule-library', group: 'Gaming', name: 'Steam Library vertical cover', w: 600, h: 900, hot: true,
    keywords: ['steam', 'library cover', 'vertical capsule', 'box art', 'game grid', '2:3'] },
  { id: 'steam-header', group: 'Gaming', name: 'Steam Store header capsule', w: 460, h: 215,
    keywords: ['steam', 'header capsule', 'game banner', 'small banner'] },
  { id: 'roblox-shirt', group: 'Gaming', name: 'Roblox Clothing template', w: 585, h: 559,
    keywords: ['roblox', 'shirt', 'pants', 'clothing template', 'outfit'] },
  { id: 'roblox-game-icon', group: 'Gaming', name: 'Roblox Experience icon', w: 512, h: 512,
    keywords: ['roblox', 'game icon', 'experience logo', 'thumbnail'] },

  // ==========================================
  // ---- ALTERNATIVE & EMERGING SOCIAL ----
  // ==========================================
  { id: 'bluesky-post', group: 'Emerging Social', name: 'Bluesky post card', w: 1200, h: 630,
    keywords: ['bluesky', 'bsky', 'post', 'card', 'link preview', 'feed'] },
  { id: 'bluesky-header', group: 'Emerging Social', name: 'Bluesky profile header', w: 1500, h: 500,
    keywords: ['bluesky', 'bsky', 'header', 'banner', 'profile background'] },
  { id: 'mastodon-header', group: 'Emerging Social', name: 'Mastodon profile banner', w: 1500, h: 500,
    keywords: ['mastodon', 'fediverse', 'banner', 'header'] },
  { id: 'lemon8-post', group: 'Emerging Social', name: 'Lemon8 portrait post', w: 1080, h: 1440,
    keywords: ['lemon8', 'lemon 8', 'portrait', '3:4', 'lifestyle post'] },
  { id: 'reddit-banner', group: 'Emerging Social', name: 'Reddit Subreddit banner', w: 1920, h: 384,
    keywords: ['reddit', 'subreddit', 'banner', 'header', 'community banner', '5:1'] },
  { id: 'reddit-icon', group: 'Emerging Social', name: 'Reddit Subreddit icon', w: 256, h: 256,
    keywords: ['reddit', 'subreddit icon', 'community logo', 'snoo'] },

  // ==========================================
  // ---- E-COMMERCE & RETAIL ----
  // ==========================================
  { id: 'shop-product', group: 'Commerce', name: 'Shopify / General product photo', w: 2048, h: 2048, hot: true,
    keywords: ['product', 'shopify', 'store', 'ecommerce', 'e-commerce', 'catalog', 'listing', 'square', 'shop', '1:1', '2048x2048'] },
  { id: 'amazon-main', group: 'Commerce', name: 'Amazon Main listing image', w: 2000, h: 2000, hot: true,
    keywords: ['amazon', 'main image', 'product photo', 'white background', 'square', 'fba', 'zoomable'] },
  { id: 'amazon-aplus', group: 'Commerce', name: 'Amazon A+ Content module', w: 970, h: 600,
    keywords: ['amazon', 'a+ content', 'ebc', 'brand banner', 'product description module'] },
  { id: 'etsy-banner-big', group: 'Commerce', name: 'Etsy Big shop banner', w: 3360, h: 840,
    keywords: ['etsy', 'store banner', 'big banner', 'shop cover', 'header', '4:1'] },
  { id: 'etsy-banner-mini', group: 'Commerce', name: 'Etsy Mini shop banner', w: 1200, h: 300,
    keywords: ['etsy', 'mini banner', 'small banner', 'shop cover'] },
  { id: 'etsy-icon', group: 'Commerce', name: 'Etsy Shop icon', w: 500, h: 500,
    keywords: ['etsy', 'shop icon', 'logo', 'store photo', 'avatar'] },
  { id: 'poshmark-listing', group: 'Commerce', name: 'Poshmark / Mercari photo', w: 1080, h: 1080,
    keywords: ['poshmark', 'mercari', 'depop', 'reseller', 'listing', 'closet photo'] },

  // ==========================================
  // ---- APP STORE & SOFTWARE ASSETS ----
  // ==========================================
  { id: 'app-iphone-67', group: 'App Store', name: 'iOS Screenshot (6.7" iPhone)', w: 1290, h: 2796, hot: true,
    keywords: ['app store', 'ios', 'iphone', 'screenshot', 'apple', 'mobile preview', '15 pro max', '16 pro max'] },
  { id: 'app-iphone-65', group: 'App Store', name: 'iOS Screenshot (6.5" iPhone)', w: 1242, h: 2688,
    keywords: ['app store', 'ios', 'iphone', 'screenshot', 'apple', 'xs max', '11 pro max'] },
  { id: 'app-ipad-129', group: 'App Store', name: 'iOS Screenshot (12.9" iPad)', w: 2048, h: 2732,
    keywords: ['app store', 'ios', 'ipad', 'screenshot', 'apple tablet', 'ipad pro'] },
  { id: 'app-mac-icon', group: 'App Store', name: 'macOS / iOS App Icon', w: 1024, h: 1024, hot: true,
    keywords: ['app icon', 'ios icon', 'mac icon', 'apple store icon', 'logo', '1024x1024', 'application'] },
  { id: 'play-store-phone', group: 'App Store', name: 'Google Play Screenshot', w: 1080, h: 1920,
    keywords: ['google play', 'android screenshot', 'phone preview', 'play store'] },
  { id: 'play-store-feature', group: 'App Store', name: 'Google Play Feature Graphic', w: 1024, h: 500, hot: true,
    keywords: ['google play', 'android', 'feature graphic', 'store cover', 'app store banner'] },
  { id: 'play-store-icon', group: 'App Store', name: 'Google Play Store Icon', w: 512, h: 512,
    keywords: ['google play', 'android icon', 'play store logo', 'app icon'] },

  // ==========================================
  // ---- PRESENTATIONS & SLIDES ----
  // ==========================================
  { id: 'slide-16-9', group: 'Presentations', name: '16:9 Widescreen slide', w: 1920, h: 1080, hot: true,
    keywords: ['slide', 'presentation', 'powerpoint', 'keynote', 'deck', 'pitch deck', 'google slides', '16:9', 'widescreen', '1080p'] },
  { id: 'slide-4-3', group: 'Presentations', name: '4:3 Standard slide', w: 1600, h: 1200,
    keywords: ['slide', 'presentation', 'powerpoint', 'keynote', 'deck', '4:3', 'standard slide', 'classic'] },

  // ==========================================
  // ---- WEB, SEO & METADATA ----
  // ==========================================
  { id: 'og-image', group: 'Web & Metadata', name: 'Open Graph / Social preview', w: 1200, h: 630, hot: true,
    keywords: ['og', 'opengraph', 'open graph', 'link preview', 'share card', 'social preview',
               'meta', 'seo', 'twitter card', 'unfurl', 'website', 'slack preview', '1.91:1'] },
  { id: 'web-hero-hd', group: 'Web & Metadata', name: 'Website Hero (Full HD)', w: 1920, h: 1080, hot: true,
    keywords: ['hero', 'banner', 'header', 'website', 'web', 'full hd', '1080p', 'landing page', '16:9'] },
  { id: 'web-hero-4k', group: 'Web & Metadata', name: 'Website Hero (4K)', w: 3840, h: 2160,
    keywords: ['hero', 'banner', 'header', 'website', '4k', 'uhd', 'landing page'] },
  { id: 'web-blog', group: 'Web & Metadata', name: 'Blog post featured image', w: 1200, h: 600,
    keywords: ['blog', 'article', 'post', 'header', 'featured', 'cover', '2:1'] },
  { id: 'web-email-banner', group: 'Web & Metadata', name: 'Email newsletter header', w: 600, h: 200,
    keywords: ['email', 'newsletter', 'mailchimp', 'klaviyo', 'header', 'banner', 'edm', '3:1'] },
  { id: 'web-email-sig', group: 'Web & Metadata', name: 'Email signature banner', w: 600, h: 100,
    keywords: ['email signature', 'footer', 'signature banner', 'mail signature', '6:1'] },
  { id: 'web-favicon', group: 'Web & Metadata', name: 'Web App Favicon / Touch Icon', w: 512, h: 512,
    keywords: ['icon', 'favicon', 'app icon', 'logo', 'square', 'pwa', 'touch icon', 'browser icon'] },

  // ==========================================
  // ---- DISPLAY ADS (IAB STANDARDS) ----
  // ==========================================
  { id: 'ad-leaderboard', group: 'Display Ads', name: 'Leaderboard', w: 728, h: 90, hot: true,
    keywords: ['ad', 'ads', 'google', 'display', 'adwords', 'leaderboard', 'banner', 'top banner', '728x90'] },
  { id: 'ad-large-leaderboard', group: 'Display Ads', name: 'Large leaderboard', w: 970, h: 90,
    keywords: ['ad', 'ads', 'google', 'display', 'large leaderboard', 'top banner', '970x90'] },
  { id: 'ad-billboard', group: 'Display Ads', name: 'Billboard ad', w: 970, h: 250,
    keywords: ['ad', 'ads', 'google', 'display', 'billboard', 'large banner', '970x250'] },
  { id: 'ad-medium-rect', group: 'Display Ads', name: 'Medium rectangle (MREC)', w: 300, h: 250, hot: true,
    keywords: ['ad', 'ads', 'google', 'display', 'mrec', 'medium rectangle', 'box ad', 'sidebar ad', '300x250'] },
  { id: 'ad-large-rect', group: 'Display Ads', name: 'Large rectangle', w: 336, h: 280,
    keywords: ['ad', 'ads', 'google', 'display', 'large rectangle', 'box ad', '336x280'] },
  { id: 'ad-half-page', group: 'Display Ads', name: 'Half page / Filmstrip', w: 300, h: 600, hot: true,
    keywords: ['ad', 'ads', 'google', 'display', 'half page', 'skyscraper', 'sidebar', 'tall ad', '300x600'] },
  { id: 'ad-wide-skyscraper', group: 'Display Ads', name: 'Wide skyscraper', w: 160, h: 600,
    keywords: ['ad', 'ads', 'google', 'display', 'skyscraper', 'tall', 'sidebar', '160x600'] },
  { id: 'ad-mobile-banner', group: 'Display Ads', name: 'Mobile banner', w: 320, h: 50,
    keywords: ['ad', 'ads', 'google', 'display', 'mobile banner', 'phone ad', '320x50'] },
  { id: 'ad-mobile-large', group: 'Display Ads', name: 'Large mobile banner', w: 320, h: 100,
    keywords: ['ad', 'ads', 'google', 'display', 'large mobile banner', '320x100'] },
  { id: 'ad-square', group: 'Display Ads', name: 'Square ad', w: 250, h: 250,
    keywords: ['ad', 'ads', 'google', 'display', 'square ad', '250x250'] },

  // ==========================================
  // ---- WALLPAPERS & DISPLAYS ----
  // ==========================================
  { id: 'wall-4k', group: 'Wallpapers', name: '4K Desktop wallpaper (16:9)', w: 3840, h: 2160, hot: true,
    keywords: ['wallpaper', 'desktop', '4k', 'uhd', 'background', 'screen', '16:9', 'monitor wallpaper', '2160p'] },
  { id: 'wall-fhd', group: 'Wallpapers', name: 'Full HD Desktop wallpaper (16:9)', w: 1920, h: 1080,
    keywords: ['wallpaper', 'desktop', '1080p', 'fhd', 'full hd', 'background', 'screen', '16:9'] },
  { id: 'wall-ultrawide', group: 'Wallpapers', name: 'Ultrawide wallpaper (21:9)', w: 3440, h: 1440, hot: true,
    keywords: ['wallpaper', 'desktop', 'ultrawide', 'curved', '21:9', 'background', 'monitor', '1440p'] },
  { id: 'wall-super-ultrawide', group: 'Wallpapers', name: 'Super Ultrawide wallpaper (32:9)', w: 5120, h: 1440,
    keywords: ['wallpaper', 'desktop', 'super ultrawide', '32:9', 'dual monitor', 'odyssey g9'] },
  { id: 'wall-iphone', group: 'Wallpapers', name: 'iPhone mobile wallpaper', w: 1170, h: 2532,
    keywords: ['wallpaper', 'mobile', 'phone wallpaper', 'iphone wallpaper', 'lock screen', 'vertical'] },
  { id: 'wall-apple-watch', group: 'Wallpapers', name: 'Apple Watch face background', w: 396, h: 484,
    keywords: ['apple watch', 'watch face', 'smartwatch', 'wallpaper', 'wearable'] },

  // ==========================================
  // ---- PRINT & PHYSICAL MEDIA ----
  // ==========================================
  { id: 'print-a0', group: 'Print Standard', name: 'A0 at 300 dpi', w: 9933, h: 14043,
    keywords: ['print', 'a0', 'billboard', 'large poster', '300dpi', 'dpi'] },
  { id: 'print-a1', group: 'Print Standard', name: 'A1 at 300 dpi', w: 7016, h: 9933,
    keywords: ['print', 'a1', 'poster', 'exhibition', '300dpi'] },
  { id: 'print-a2', group: 'Print Standard', name: 'A2 at 300 dpi', w: 4960, h: 7016,
    keywords: ['print', 'a2', 'poster', 'print art', '300dpi'] },
  { id: 'print-a3', group: 'Print Standard', name: 'A3 at 300 dpi', w: 3508, h: 4960,
    keywords: ['print', 'a3', 'poster', 'small poster', '300dpi'] },
  { id: 'print-a4', group: 'Print Standard', name: 'A4 at 300 dpi', w: 2480, h: 3508, hot: true,
    keywords: ['print', 'a4', 'page', 'standard page', 'flyer', 'document', 'letterhead', '300dpi'] },
  { id: 'print-a5', group: 'Print Standard', name: 'A5 at 300 dpi', w: 1748, h: 2480,
    keywords: ['print', 'a5', 'flyer', 'leaflet', 'booklet', '300dpi'] },
  { id: 'print-letter', group: 'Print Standard', name: 'US Letter at 300 dpi', w: 2550, h: 3300, hot: true,
    keywords: ['print', 'letter', 'us letter', 'paper', 'flyer', '8.5x11', '8.5 x 11', 'document'] },
  { id: 'print-legal', group: 'Print Standard', name: 'US Legal at 300 dpi', w: 2550, h: 4200,
    keywords: ['print', 'legal', 'us legal', '8.5x14', 'document'] },
  { id: 'print-tabloid', group: 'Print Standard', name: 'Tabloid (11 × 17) at 300 dpi', w: 3300, h: 5100,
    keywords: ['print', 'tabloid', 'ledger', '11x17', '11 x 17', 'poster'] },
  { id: 'print-poster-18x24', group: 'Print Photo & Art', name: '18 × 24 poster at 300 dpi', w: 5400, h: 7200, hot: true,
    keywords: ['print', 'poster', '18x24', '18 x 24', '3:4', 'wall art', 'frame print'] },
  { id: 'print-poster-24x36', group: 'Print Photo & Art', name: '24 × 36 poster at 300 dpi', w: 7200, h: 10800,
    keywords: ['print', 'poster', '24x36', '24 x 36', 'large poster', 'movie poster'] },
  { id: 'print-photo-4x6', group: 'Print Photo & Art', name: '4 × 6 photo at 300 dpi', w: 1800, h: 1200, hot: true,
    keywords: ['print', 'photo', '4x6', '6x4', 'postcard', '3:2', 'photo print'] },
  { id: 'print-photo-5x7', group: 'Print Photo & Art', name: '5 × 7 photo at 300 dpi', w: 2100, h: 1500,
    keywords: ['print', 'photo', '5x7', '7x5', 'greeting card', 'invitation'] },
  { id: 'print-photo-8x10', group: 'Print Photo & Art', name: '8 × 10 photo at 300 dpi', w: 3000, h: 2400,
    keywords: ['print', 'photo', '8x10', '10x8', 'portrait print', 'framed photo', '4:5'] },
  { id: 'print-card', group: 'Print Corporate', name: 'Standard Business Card at 300 dpi', w: 1050, h: 600, hot: true,
    keywords: ['print', 'business card', 'card', 'name card', 'visiting card', '3.5x2'] },
  { id: 'book-cover-kdp', group: 'Publishing', name: 'KDP Paperback Cover (6 × 9 standard)', w: 1800, h: 2700,
    keywords: ['book cover', 'amazon kdp', 'kindle', 'paperback', 'novel', '6x9', 'book mockup'] }
];

// Ratio shorthand mapped to concrete pixel sizes for fast resolution
export const RATIO_SIZES = [
  { ratio: 1 / 1, w: 1080, h: 1080 },
  { ratio: 4 / 5, w: 1080, h: 1350 },
  { ratio: 5 / 4, w: 1350, h: 1080 },
  { ratio: 9 / 16, w: 1080, h: 1920 },
  { ratio: 16 / 9, w: 1920, h: 1080 },
  { ratio: 3 / 2, w: 1800, h: 1200 },
  { ratio: 2 / 3, w: 1200, h: 1800 },
  { ratio: 4 / 3, w: 1600, h: 1200 },
  { ratio: 3 / 4, w: 1200, h: 1600 },
  { ratio: 21 / 9, w: 2520, h: 1080 },
  { ratio: 32 / 9, w: 3840, h: 1080 },
  { ratio: 2 / 1, w: 1600, h: 800 },
  { ratio: 1.91 / 1, w: 1200, h: 628 },
  { ratio: 1 / 2.1, w: 1000, h: 2100 },
  { ratio: 3 / 1, w: 1500, h: 500 },
  { ratio: 4 / 1, w: 1600, h: 400 },
];

export const HOT = PRESETS.filter((p) => p.hot);