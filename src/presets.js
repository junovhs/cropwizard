// The size catalogue.
//
// `keywords` is the whole trick. People do not search for "Instagram Portrait
// Post" — they search for "ig tall", "4x5", "the one that takes up more feed".
// Every way a marketer might name a size lives here, so the matcher stays dumb
// and the results stay right.

export const PRESETS = [
  // ---- Instagram ----
  { id: 'ig-square', group: 'Instagram', name: 'Square post', w: 1080, h: 1080, hot: true,
    keywords: ['ig', 'insta', 'instagram', 'square', 'feed', '1:1', 'grid', 'carousel'] },
  { id: 'ig-portrait', group: 'Instagram', name: 'Portrait post', w: 1080, h: 1350, hot: true,
    keywords: ['ig', 'insta', 'instagram', 'tall', 'portrait', 'vertical', '4:5', 'feed', 'carousel', 'biggest', 'more feed'] },
  { id: 'ig-landscape', group: 'Instagram', name: 'Landscape post', w: 1080, h: 566,
    keywords: ['ig', 'insta', 'instagram', 'wide', 'landscape', 'horizontal', 'feed'] },
  { id: 'ig-story', group: 'Instagram', name: 'Story / Reel', w: 1080, h: 1920, hot: true,
    keywords: ['ig', 'insta', 'instagram', 'story', 'stories', 'reel', 'reels', 'vertical', 'fullscreen', 'full screen', '9:16', 'phone'] },
  { id: 'ig-profile', group: 'Instagram', name: 'Profile picture', w: 320, h: 320,
    keywords: ['ig', 'insta', 'instagram', 'profile', 'avatar', 'pfp', 'headshot', 'dp'] },

  // ---- TikTok ----
  { id: 'tiktok-video', group: 'TikTok', name: 'Video / cover', w: 1080, h: 1920,
    keywords: ['tiktok', 'tik tok', 'video', 'vertical', 'fullscreen', '9:16', 'cover', 'shorts'] },
  { id: 'tiktok-profile', group: 'TikTok', name: 'Profile picture', w: 200, h: 200,
    keywords: ['tiktok', 'tik tok', 'profile', 'avatar', 'pfp'] },

  // ---- Facebook ----
  { id: 'fb-feed', group: 'Facebook', name: 'Feed / link image', w: 1200, h: 630, hot: true,
    // 'og'/'preview' deliberately live only on the Open Graph preset, so a
    // query naming the standard gets the size labelled by the standard.
    keywords: ['fb', 'facebook', 'feed', 'link', 'shared link', 'share', 'post', 'meta'] },
  { id: 'fb-square', group: 'Facebook', name: 'Square post', w: 1080, h: 1080,
    keywords: ['fb', 'facebook', 'square', 'post', 'feed'] },
  { id: 'fb-story', group: 'Facebook', name: 'Story', w: 1080, h: 1920,
    keywords: ['fb', 'facebook', 'story', 'stories', 'vertical'] },
  { id: 'fb-cover', group: 'Facebook', name: 'Page cover', w: 820, h: 312,
    keywords: ['fb', 'facebook', 'cover', 'banner', 'header', 'page'] },
  { id: 'fb-event', group: 'Facebook', name: 'Event cover', w: 1920, h: 1005,
    keywords: ['fb', 'facebook', 'event', 'cover', 'banner'] },

  // ---- X / Twitter ----
  { id: 'x-post', group: 'X / Twitter', name: 'Post image', w: 1600, h: 900, hot: true,
    keywords: ['x', 'twitter', 'tweet', 'post', 'timeline', 'card', '16:9'] },
  { id: 'x-header', group: 'X / Twitter', name: 'Profile header', w: 1500, h: 500,
    keywords: ['x', 'twitter', 'header', 'banner', 'cover', 'profile'] },
  { id: 'x-profile', group: 'X / Twitter', name: 'Profile picture', w: 400, h: 400,
    keywords: ['x', 'twitter', 'profile', 'avatar', 'pfp'] },

  // ---- LinkedIn ----
  { id: 'li-post', group: 'LinkedIn', name: 'Feed post', w: 1200, h: 627,
    keywords: ['linkedin', 'li', 'post', 'feed', 'share', 'link'] },
  { id: 'li-square', group: 'LinkedIn', name: 'Square post', w: 1080, h: 1080,
    keywords: ['linkedin', 'li', 'square', 'post'] },
  { id: 'li-cover', group: 'LinkedIn', name: 'Profile cover', w: 1584, h: 396,
    keywords: ['linkedin', 'li', 'cover', 'banner', 'header', 'background'] },
  { id: 'li-company', group: 'LinkedIn', name: 'Company banner', w: 1128, h: 191,
    keywords: ['linkedin', 'li', 'company', 'page', 'banner', 'header'] },

  // ---- YouTube ----
  { id: 'yt-thumb', group: 'YouTube', name: 'Thumbnail', w: 1280, h: 720, hot: true,
    keywords: ['youtube', 'yt', 'thumb', 'thumbnail', 'video', '16:9', 'preview'] },
  { id: 'yt-banner', group: 'YouTube', name: 'Channel banner', w: 2560, h: 1440,
    keywords: ['youtube', 'yt', 'banner', 'channel', 'art', 'cover', 'header'] },
  { id: 'yt-shorts', group: 'YouTube', name: 'Shorts', w: 1080, h: 1920,
    keywords: ['youtube', 'yt', 'shorts', 'short', 'vertical', '9:16'] },

  // ---- Pinterest ----
  { id: 'pin-standard', group: 'Pinterest', name: 'Standard pin', w: 1000, h: 1500,
    keywords: ['pinterest', 'pin', 'tall', '2:3', 'vertical'] },
  { id: 'pin-square', group: 'Pinterest', name: 'Square pin', w: 1000, h: 1000,
    keywords: ['pinterest', 'pin', 'square'] },
  { id: 'pin-long', group: 'Pinterest', name: 'Long pin', w: 1000, h: 2100,
    keywords: ['pinterest', 'pin', 'long', 'tall', 'infographic'] },

  // ---- Web ----
  { id: 'og-image', group: 'Web', name: 'Open Graph / link preview', w: 1200, h: 630, hot: true,
    keywords: ['og', 'opengraph', 'open graph', 'link preview', 'share card', 'social preview',
               'meta', 'seo', 'twitter card', 'unfurl', 'website', 'slack preview'] },
  { id: 'web-hero', group: 'Web', name: 'Hero banner', w: 1920, h: 1080,
    keywords: ['hero', 'banner', 'header', 'website', 'web', 'full hd', '1080p', 'landing', '16:9'] },
  { id: 'web-blog', group: 'Web', name: 'Blog header', w: 1200, h: 600,
    keywords: ['blog', 'article', 'post', 'header', 'featured', 'cover', '2:1'] },
  { id: 'web-email', group: 'Web', name: 'Email header', w: 600, h: 200,
    keywords: ['email', 'newsletter', 'mailchimp', 'klaviyo', 'header', 'banner', 'edm'] },
  { id: 'web-favicon', group: 'Web', name: 'App icon', w: 512, h: 512,
    keywords: ['icon', 'favicon', 'app icon', 'logo', 'square', 'pwa'] },

  // ---- Display ads ----
  { id: 'ad-leaderboard', group: 'Display ads', name: 'Leaderboard', w: 728, h: 90,
    keywords: ['ad', 'ads', 'google', 'display', 'adwords', 'leaderboard', 'banner', 'top'] },
  { id: 'ad-medium', group: 'Display ads', name: 'Medium rectangle', w: 300, h: 250,
    keywords: ['ad', 'ads', 'google', 'display', 'mrec', 'medium rectangle', 'box', 'sidebar'] },
  { id: 'ad-large', group: 'Display ads', name: 'Large rectangle', w: 336, h: 280,
    keywords: ['ad', 'ads', 'google', 'display', 'large rectangle'] },
  { id: 'ad-halfpage', group: 'Display ads', name: 'Half page', w: 300, h: 600,
    keywords: ['ad', 'ads', 'google', 'display', 'half page', 'skyscraper', 'sidebar', 'tall'] },
  { id: 'ad-skyscraper', group: 'Display ads', name: 'Wide skyscraper', w: 160, h: 600,
    keywords: ['ad', 'ads', 'google', 'display', 'skyscraper', 'tall', 'sidebar'] },
  { id: 'ad-mobile', group: 'Display ads', name: 'Mobile banner', w: 320, h: 50,
    keywords: ['ad', 'ads', 'google', 'display', 'mobile', 'banner', 'phone'] },

  // ---- Commerce ----
  { id: 'shop-product', group: 'Commerce', name: 'Product photo', w: 2048, h: 2048,
    keywords: ['product', 'shopify', 'store', 'ecommerce', 'e-commerce', 'catalog', 'listing', 'square', 'shop'] },
  { id: 'amazon-main', group: 'Commerce', name: 'Marketplace listing', w: 1600, h: 1600,
    keywords: ['amazon', 'etsy', 'ebay', 'marketplace', 'listing', 'product', 'main image'] },

  // ---- Print ----
  { id: 'print-a4', group: 'Print', name: 'A4 at 300 dpi', w: 2480, h: 3508,
    keywords: ['print', 'a4', 'page', 'poster', 'flyer', '300dpi', 'dpi'] },
  { id: 'print-a5', group: 'Print', name: 'A5 at 300 dpi', w: 1748, h: 2480,
    keywords: ['print', 'a5', 'flyer', 'leaflet', 'page'] },
  { id: 'print-letter', group: 'Print', name: 'US Letter at 300 dpi', w: 2550, h: 3300,
    keywords: ['print', 'letter', 'us letter', 'page', 'flyer', '8.5x11'] },
  { id: 'print-photo', group: 'Print', name: '6 × 4 photo at 300 dpi', w: 1800, h: 1200,
    keywords: ['print', 'photo', '6x4', '4x6', 'postcard', '3:2'] },
  { id: 'print-card', group: 'Print', name: 'Business card at 300 dpi', w: 1050, h: 600,
    keywords: ['print', 'business card', 'card', 'name card'] },
];

// Ratio shorthand people type directly. Mapped to a concrete, sensible size so
// "16:9" resolves to real pixels instead of an abstract shape.
export const RATIO_SIZES = [
  { ratio: 1 / 1, w: 1080, h: 1080 },
  { ratio: 4 / 5, w: 1080, h: 1350 },
  { ratio: 9 / 16, w: 1080, h: 1920 },
  { ratio: 16 / 9, w: 1920, h: 1080 },
  { ratio: 3 / 2, w: 1800, h: 1200 },
  { ratio: 2 / 3, w: 1200, h: 1800 },
  { ratio: 4 / 3, w: 1600, h: 1200 },
  { ratio: 3 / 4, w: 1200, h: 1600 },
  { ratio: 21 / 9, w: 2520, h: 1080 },
  { ratio: 2 / 1, w: 1600, h: 800 },
];

export const HOT = PRESETS.filter((p) => p.hot);
