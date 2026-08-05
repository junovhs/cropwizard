// The size catalogue.
//
// Search stays deliberately dumb: each preset carries marketer language,
// platform slang, format names, ratios, and use-case aliases. The builder
// also adds the preset id, group, name, orientation, and common dimension
// spellings automatically.

const enrichPreset = ({ id, group, name, w, h, hot = false, keywords }) => {
  const orientation = w === h
    ? ['square']
    : w > h
      ? ['landscape', 'horizontal', 'wide']
      : ['portrait', 'vertical', 'tall'];

  return {
    id,
    group,
    name,
    w,
    h,
    ...(hot ? { hot: true } : {}),
    keywords: [...new Set([
      group.toLowerCase(),
      name.toLowerCase(),
      id.replace(/-/g, ' '),
      ...orientation,
      ...keywords.split('|'),
      `${w}x${h}`,
      `${w} x ${h}`,
      `${w}×${h}`,
      `${w} by ${h}`,
      `${w}px x ${h}px`,
      `${w} ${h}`,
    ])],
  };
};

// Tuple shape: [id, group, name, width, height, hot, pipe-delimited keywords]
const RAW_PRESETS = [
  // ---- Instagram ----
  ["ig-square", "Instagram", "Square post", 1080, 1080, true, "ig|insta|instagram|square|feed|post|1:1|grid|carousel|album"],
  ["ig-portrait", "Instagram", "Portrait post", 1080, 1350, true, "ig|insta|instagram|tall|portrait|vertical|4:5|feed|carousel|biggest|more feed|takes up more feed"],
  ["ig-landscape", "Instagram", "Landscape post", 1080, 566, false, "ig|insta|instagram|wide|landscape|horizontal|feed|1.91:1"],
  ["ig-story", "Instagram", "Story", 1080, 1920, true, "ig|insta|instagram|story|stories|vertical|fullscreen|full screen|9:16|phone"],
  ["ig-reel", "Instagram", "Reel", 1080, 1920, true, "ig|insta|instagram|reel|reels|vertical video|short video|fullscreen|9:16"],
  ["ig-reel-cover", "Instagram", "Reel cover", 1080, 1920, false, "ig|insta|instagram|reel cover|reels cover|cover|thumbnail|poster frame"],
  ["ig-highlight", "Instagram", "Highlight cover", 1080, 1080, false, "ig|insta|instagram|highlight|highlights|story highlight|cover|icon|circle"],
  ["ig-profile", "Instagram", "Profile picture", 320, 320, false, "ig|insta|instagram|profile|avatar|pfp|headshot|dp|display picture"],
  ["ig-ad-square", "Instagram", "Square ad", 1080, 1080, false, "ig|instagram|ad|ads|paid social|sponsored|square ad|1:1"],
  ["ig-ad-portrait", "Instagram", "Portrait ad", 1080, 1350, false, "ig|instagram|ad|ads|paid social|sponsored|portrait ad|4:5"],

  // ---- Threads ----
  ["threads-square", "Threads", "Square post", 1080, 1080, false, "threads|meta threads|square|post|feed|1:1"],
  ["threads-portrait", "Threads", "Portrait post", 1080, 1350, false, "threads|meta threads|portrait|tall|vertical|post|feed|4:5"],
  ["threads-landscape", "Threads", "Landscape post", 1080, 566, false, "threads|meta threads|landscape|wide|horizontal|post|feed"],
  ["threads-profile", "Threads", "Profile picture", 320, 320, false, "threads|meta threads|profile|avatar|pfp|display picture"],

  // ---- TikTok ----
  ["tiktok-video", "TikTok", "Vertical video", 1080, 1920, true, "tiktok|tik tok|video|vertical|fullscreen|full screen|9:16|short video|for you|fyp"],
  ["tiktok-cover", "TikTok", "Video cover", 1080, 1920, false, "tiktok|tik tok|cover|thumbnail|video cover|poster|poster frame"],
  ["tiktok-carousel", "TikTok", "Photo carousel", 1080, 1920, false, "tiktok|tik tok|photo mode|carousel|slideshow|photos|vertical|9:16"],
  ["tiktok-square", "TikTok", "Square video", 1080, 1080, false, "tiktok|tik tok|square|video|1:1"],
  ["tiktok-landscape", "TikTok", "Landscape video", 1920, 1080, false, "tiktok|tik tok|landscape|horizontal|wide|video|16:9"],
  ["tiktok-profile", "TikTok", "Profile picture", 200, 200, false, "tiktok|tik tok|profile|avatar|pfp|display picture"],
  ["tiktok-ad-square", "TikTok", "Carousel ad — square", 640, 640, false, "tiktok|tik tok|ad|ads|carousel ad|square ad|1:1|paid social"],
  ["tiktok-ad-landscape", "TikTok", "Carousel ad — landscape", 1200, 628, false, "tiktok|tik tok|ad|ads|carousel ad|landscape ad|horizontal|1.91:1|paid social"],

  // ---- Facebook ----
  ["fb-feed", "Facebook", "Feed / link image", 1200, 630, true, "fb|facebook|feed|link|shared link|share|post|meta|link image|website preview"],
  ["fb-square", "Facebook", "Square post", 1080, 1080, false, "fb|facebook|square|post|feed|1:1"],
  ["fb-portrait", "Facebook", "Portrait post", 1080, 1350, false, "fb|facebook|portrait|tall|vertical|post|feed|4:5"],
  ["fb-story", "Facebook", "Story", 1080, 1920, false, "fb|facebook|story|stories|vertical|fullscreen|9:16"],
  ["fb-reel", "Facebook", "Reel", 1080, 1920, false, "fb|facebook|reel|reels|vertical video|short video|9:16"],
  ["fb-cover", "Facebook", "Page cover", 1640, 624, false, "fb|facebook|cover|banner|header|page|business page|timeline cover"],
  ["fb-profile", "Facebook", "Profile picture", 320, 320, false, "fb|facebook|profile|avatar|pfp|display picture|page logo"],
  ["fb-event", "Facebook", "Event cover", 1920, 1005, false, "fb|facebook|event|cover|banner|event image|event header"],
  ["fb-group-cover", "Facebook", "Group cover", 1640, 856, false, "fb|facebook|group|community|cover|banner|header"],
  ["fb-carousel", "Facebook", "Carousel card", 1080, 1080, false, "fb|facebook|carousel|card|multi image|ad|square|1:1"],
  ["fb-marketplace", "Facebook", "Marketplace listing", 1200, 1200, false, "fb|facebook|marketplace|listing|product|commerce|shop|square"],

  // ---- Messenger ----
  ["messenger-story", "Messenger", "Story ad", 1080, 1920, false, "messenger|facebook messenger|story|story ad|vertical ad|fullscreen|9:16"],
  ["messenger-inbox-ad", "Messenger", "Inbox ad", 1200, 628, false, "messenger|facebook messenger|inbox ad|sponsored|ad|landscape|1.91:1"],
  ["messenger-profile", "Messenger", "Profile picture", 640, 640, false, "messenger|facebook messenger|profile|avatar|pfp|display picture"],

  // ---- X / Twitter ----
  ["x-post", "X / Twitter", "Post image", 1600, 900, true, "x|twitter|tweet|post|timeline|card|16:9|landscape|wide"],
  ["x-square", "X / Twitter", "Square post", 1080, 1080, false, "x|twitter|tweet|square|post|1:1"],
  ["x-portrait", "X / Twitter", "Portrait post", 1080, 1350, false, "x|twitter|tweet|portrait|tall|vertical|post|4:5"],
  ["x-header", "X / Twitter", "Profile header", 1500, 500, false, "x|twitter|header|banner|cover|profile|3:1"],
  ["x-profile", "X / Twitter", "Profile picture", 400, 400, false, "x|twitter|profile|avatar|pfp|display picture"],
  ["x-website-card", "X / Twitter", "Website card", 1200, 628, false, "x|twitter|website card|link card|link preview|summary card|large image|1.91:1"],
  ["x-ad-portrait", "X / Twitter", "Portrait ad", 1080, 1350, false, "x|twitter|ad|ads|sponsored|paid social|portrait ad|4:5"],

  // ---- LinkedIn ----
  ["li-post", "LinkedIn", "Feed / link post", 1200, 627, true, "linkedin|li|post|feed|share|link|article|1.91:1|b2b"],
  ["li-square", "LinkedIn", "Square post", 1080, 1080, false, "linkedin|li|square|post|feed|carousel|document|1:1"],
  ["li-portrait", "LinkedIn", "Portrait post", 1080, 1350, false, "linkedin|li|portrait|tall|vertical|post|feed|document|4:5"],
  ["li-profile", "LinkedIn", "Profile picture", 400, 400, false, "linkedin|li|profile|headshot|avatar|pfp|professional photo"],
  ["li-cover", "LinkedIn", "Profile cover", 1584, 396, false, "linkedin|li|cover|banner|header|background|personal profile|4:1"],
  ["li-company-logo", "LinkedIn", "Company logo", 400, 400, false, "linkedin|li|company|page|logo|brand|avatar|square"],
  ["li-company", "LinkedIn", "Company page cover", 1128, 191, false, "linkedin|li|company|page|cover|banner|header|business page"],
  ["li-event", "LinkedIn", "Event cover", 1776, 444, false, "linkedin|li|event|cover|banner|header|4:1"],
  ["li-life-main", "LinkedIn", "Life tab main image", 1128, 376, false, "linkedin|li|life tab|career page|employer brand|main image|3:1"],
  ["li-life-module", "LinkedIn", "Life tab custom module", 502, 282, false, "linkedin|li|life tab|career page|custom module|module image|16:9"],
  ["li-article-cover", "LinkedIn", "Article cover", 1280, 720, false, "linkedin|li|article|newsletter|cover|hero|featured image|16:9"],
  ["li-message-ad", "LinkedIn", "Message ad image", 300, 250, false, "linkedin|li|message ad|conversation ad|sponsored message|inmail|medium rectangle"],

  // ---- YouTube ----
  ["yt-thumb", "YouTube", "Video thumbnail", 1280, 720, true, "youtube|yt|thumb|thumbnail|video|16:9|preview|cover"],
  ["yt-shorts", "YouTube", "Shorts video", 1080, 1920, true, "youtube|yt|shorts|short|vertical|9:16|short video"],
  ["yt-shorts-thumb", "YouTube", "Shorts thumbnail", 2160, 3840, false, "youtube|yt|shorts thumbnail|shorts cover|vertical thumbnail|9:16"],
  ["yt-banner", "YouTube", "Channel banner", 2560, 1440, false, "youtube|yt|banner|channel|art|cover|header|tv"],
  ["yt-profile", "YouTube", "Channel profile picture", 800, 800, false, "youtube|yt|channel icon|profile|avatar|pfp|logo"],
  ["yt-watermark", "YouTube", "Video watermark", 150, 150, false, "youtube|yt|watermark|subscribe button|branding|channel watermark|logo"],
  ["yt-community-square", "YouTube", "Community post — square", 1080, 1080, false, "youtube|yt|community|community post|square|post|1:1"],
  ["yt-community-portrait", "YouTube", "Community post — portrait", 1080, 1350, false, "youtube|yt|community|community post|portrait|vertical|4:5"],
  ["yt-podcast", "YouTube", "Podcast cover", 3000, 3000, false, "youtube|yt|podcast|podcast cover|show art|album art|square"],

  // ---- Pinterest ----
  ["pin-standard", "Pinterest", "Standard pin", 1000, 1500, true, "pinterest|pin|tall|2:3|vertical|standard pin"],
  ["pin-square", "Pinterest", "Square pin", 1000, 1000, false, "pinterest|pin|square|1:1"],
  ["pin-portrait", "Pinterest", "Portrait pin", 1000, 1250, false, "pinterest|pin|portrait|4:5|vertical"],
  ["pin-long", "Pinterest", "Long pin", 1000, 2100, false, "pinterest|pin|long|tall|infographic|extended pin"],
  ["pin-video", "Pinterest", "Full-screen video pin", 1080, 1920, false, "pinterest|pin|video pin|vertical video|full bleed|fullscreen|9:16"],
  ["pin-cover", "Pinterest", "Profile cover", 1600, 900, false, "pinterest|pin|profile cover|cover|banner|header|16:9"],
  ["pin-profile", "Pinterest", "Profile picture", 280, 280, false, "pinterest|pin|profile|avatar|pfp|display picture"],

  // ---- Snapchat ----
  ["snap-story", "Snapchat", "Story / Snap", 1080, 1920, false, "snapchat|snap|story|snap|vertical|fullscreen|9:16"],
  ["snap-ad", "Snapchat", "Single image or video ad", 1080, 1920, false, "snapchat|snap|ad|ads|sponsored|vertical ad|9:16"],
  ["snap-filter", "Snapchat", "Geofilter", 1080, 2340, false, "snapchat|snap|geofilter|filter|overlay|location filter"],
  ["snap-profile", "Snapchat", "Public profile picture", 320, 320, false, "snapchat|snap|profile|avatar|pfp|public profile"],
  ["snap-lens-icon", "Snapchat", "Lens icon", 320, 320, false, "snapchat|snap|lens|lens icon|filter icon|ar lens"],

  // ---- Bluesky ----
  ["bsky-post", "Bluesky", "Landscape post image", 1600, 900, false, "bluesky|blue sky|bsky|skeet|post|feed|landscape|16:9"],
  ["bsky-square", "Bluesky", "Square post image", 1080, 1080, false, "bluesky|blue sky|bsky|square|post|1:1"],
  ["bsky-profile", "Bluesky", "Profile picture", 400, 400, false, "bluesky|blue sky|bsky|profile|avatar|pfp"],
  ["bsky-banner", "Bluesky", "Profile banner", 1500, 500, false, "bluesky|blue sky|bsky|banner|cover|header|profile"],

  // ---- Reddit ----
  ["reddit-post", "Reddit", "Post image", 1200, 628, false, "reddit|subreddit|post|link|preview|landscape|1.91:1"],
  ["reddit-square", "Reddit", "Square post", 1080, 1080, false, "reddit|subreddit|square|post|1:1"],
  ["reddit-community-icon", "Reddit", "Community icon", 256, 256, false, "reddit|subreddit|community icon|icon|avatar|logo"],
  ["reddit-banner", "Reddit", "Community banner", 1920, 384, false, "reddit|subreddit|banner|cover|header|community"],
  ["reddit-mobile-banner", "Reddit", "Mobile community banner", 1600, 480, false, "reddit|subreddit|mobile banner|cover|header|community"],

  // ---- Twitch ----
  ["twitch-video", "Twitch", "Stream / video canvas", 1920, 1080, false, "twitch|stream|streaming|video|canvas|overlay|16:9|1080p"],
  ["twitch-thumb", "Twitch", "Video thumbnail", 1280, 720, false, "twitch|stream|thumbnail|video cover|preview|16:9"],
  ["twitch-profile", "Twitch", "Profile picture", 800, 800, false, "twitch|stream|profile|avatar|pfp|channel icon"],
  ["twitch-banner", "Twitch", "Profile banner", 1200, 480, false, "twitch|stream|profile banner|cover|header|channel banner"],
  ["twitch-offline", "Twitch", "Offline screen", 1920, 1080, false, "twitch|stream|offline|offline screen|be right back|brb|ending screen|16:9"],
  ["twitch-panel", "Twitch", "Channel panel", 320, 100, false, "twitch|stream|panel|about panel|donate panel|schedule panel|channel panel"],

  // ---- Discord ----
  ["discord-profile", "Discord", "Profile picture", 512, 512, false, "discord|profile|avatar|pfp|user icon"],
  ["discord-profile-banner", "Discord", "Profile banner", 600, 240, false, "discord|profile banner|cover|header|nitro banner"],
  ["discord-server-icon", "Discord", "Server icon", 512, 512, false, "discord|server|server icon|guild icon|community icon|logo"],
  ["discord-server-banner", "Discord", "Server banner", 960, 540, false, "discord|server banner|guild banner|cover|header|16:9"],
  ["discord-event", "Discord", "Scheduled event cover", 800, 320, false, "discord|event|scheduled event|event cover|banner"],
  ["discord-invite-bg", "Discord", "Invite splash", 1920, 1080, false, "discord|invite|invite background|invite splash|server splash|16:9"],

  // ---- Messaging ----
  ["whatsapp-status", "Messaging", "WhatsApp Status", 1080, 1920, false, "whatsapp|wa|status|story|vertical|fullscreen|9:16"],
  ["whatsapp-profile", "Messaging", "WhatsApp profile picture", 500, 500, false, "whatsapp|wa|profile|avatar|pfp|display picture|dp"],
  ["whatsapp-product", "Messaging", "WhatsApp catalog product", 1000, 1000, false, "whatsapp|wa|catalog|product|shop|commerce|listing|square"],
  ["telegram-story", "Messaging", "Telegram Story", 1080, 1920, false, "telegram|tg|story|vertical|fullscreen|9:16"],
  ["telegram-profile", "Messaging", "Telegram profile picture", 512, 512, false, "telegram|tg|profile|avatar|pfp|channel photo|group photo"],
  ["slack-profile", "Messaging", "Slack profile picture", 512, 512, false, "slack|profile|avatar|pfp|headshot|workspace"],

  // ---- Google Business Profile ----
  ["gbp-post", "Google Business Profile", "Post image", 1200, 900, false, "google business|google business profile|gbp|gmb|post|update|offer|event|4:3"],
  ["gbp-cover", "Google Business Profile", "Cover photo", 1024, 576, false, "google business|google business profile|gbp|gmb|cover|banner|header|16:9"],
  ["gbp-logo", "Google Business Profile", "Logo", 720, 720, false, "google business|google business profile|gbp|gmb|logo|profile|avatar|square"],
  ["gbp-product", "Google Business Profile", "Product photo", 1200, 900, false, "google business|google business profile|gbp|gmb|product|menu|service|listing|4:3"],

  // ---- Web ----
  ["og-image", "Web", "Open Graph / link preview", 1200, 630, true, "og|opengraph|open graph|link preview|share card|social preview|meta|seo|twitter card|unfurl|website|slack preview"],
  ["web-hero", "Web", "Hero banner — 16:9", 1920, 1080, true, "hero|banner|header|website|web|full hd|1080p|landing|16:9|above the fold"],
  ["web-hero-wide", "Web", "Hero banner — wide", 1920, 800, false, "hero|banner|header|website|web|landing|wide hero|cinematic|desktop hero"],
  ["web-hero-mobile", "Web", "Mobile hero", 1080, 1350, false, "hero|mobile hero|website|web|landing|phone|portrait|4:5"],
  ["web-blog", "Web", "Blog header", 1200, 600, false, "blog|article|post|header|featured|cover|2:1|editorial"],
  ["web-featured", "Web", "Featured image", 1600, 900, false, "website|web|featured image|article image|blog cover|thumbnail|16:9"],
  ["web-card-landscape", "Web", "Content card — landscape", 800, 450, false, "website|web|card|content card|tile|thumbnail|landscape|16:9"],
  ["web-card-square", "Web", "Content card — square", 800, 800, false, "website|web|card|content card|tile|thumbnail|square|1:1"],
  ["web-favicon", "Web", "App icon / favicon master", 512, 512, false, "icon|favicon|app icon|logo|square|pwa|site icon"],
  ["web-apple-touch", "Web", "Apple touch icon", 180, 180, false, "apple touch icon|touch icon|ios web icon|safari icon|web app icon"],
  ["web-pwa-small", "Web", "PWA icon — 192", 192, 192, false, "pwa|progressive web app|manifest icon|android web icon|small app icon"],
  ["web-browser-extension", "Web", "Browser extension icon", 128, 128, false, "browser extension|chrome extension|firefox add-on|extension icon|toolbar icon"],

  // ---- Email ----
  ["email-header", "Email", "Newsletter header", 600, 200, false, "email|newsletter|mailchimp|klaviyo|header|banner|edm|email marketing"],
  ["email-hero", "Email", "Newsletter hero", 1200, 600, false, "email|newsletter|hero|banner|campaign|edm|2:1|retina"],
  ["email-product", "Email", "Product block", 600, 600, false, "email|newsletter|product|commerce|shop|square|product block"],
  ["email-feature", "Email", "Feature block", 600, 400, false, "email|newsletter|feature|content block|article|promotion"],
  ["email-divider", "Email", "Section divider", 600, 100, false, "email|newsletter|divider|section banner|strip|separator"],
  ["email-signature", "Email", "Email signature banner", 600, 150, false, "email|signature|email signature|footer banner|contact banner"],

  // ---- Display ads ----
  ["ad-billboard", "Display ads", "Billboard", 970, 250, true, "ad|ads|google|display|programmatic|billboard|banner|iab"],
  ["ad-super-leaderboard", "Display ads", "Super leaderboard", 970, 90, false, "ad|ads|google|display|programmatic|super leaderboard|banner|iab"],
  ["ad-leaderboard", "Display ads", "Leaderboard", 728, 90, true, "ad|ads|google|display|adwords|leaderboard|banner|top|iab"],
  ["ad-full-banner", "Display ads", "Full banner", 468, 60, false, "ad|ads|display|full banner|banner|iab|legacy banner"],
  ["ad-mobile", "Display ads", "Mobile banner", 320, 50, false, "ad|ads|google|display|mobile|banner|phone|iab"],
  ["ad-large-mobile", "Display ads", "Large mobile banner", 320, 100, false, "ad|ads|google|display|large mobile banner|mobile|phone|iab"],
  ["ad-medium", "Display ads", "Medium rectangle", 300, 250, true, "ad|ads|google|display|mrec|medium rectangle|box|sidebar|iab"],
  ["ad-large", "Display ads", "Large rectangle", 336, 280, false, "ad|ads|google|display|large rectangle|box|iab"],
  ["ad-square", "Display ads", "Square", 250, 250, false, "ad|ads|display|square ad|box|iab|1:1"],
  ["ad-small-square", "Display ads", "Small square", 200, 200, false, "ad|ads|display|small square|box|iab|1:1"],
  ["ad-halfpage", "Display ads", "Half page", 300, 600, true, "ad|ads|google|display|half page|sidebar|tall|iab"],
  ["ad-skyscraper", "Display ads", "Wide skyscraper", 160, 600, false, "ad|ads|google|display|skyscraper|tall|sidebar|iab"],
  ["ad-skyscraper-narrow", "Display ads", "Skyscraper", 120, 600, false, "ad|ads|display|skyscraper|narrow|tall|sidebar|iab"],
  ["ad-portrait", "Display ads", "Portrait", 300, 1050, false, "ad|ads|display|portrait ad|tall ad|sidebar|iab"],
  ["ad-responsive-landscape", "Display ads", "Responsive display — landscape", 1200, 628, true, "ad|ads|google ads|responsive display|landscape asset|marketing image|1.91:1"],
  ["ad-responsive-square", "Display ads", "Responsive display — square", 1200, 1200, false, "ad|ads|google ads|responsive display|square asset|marketing image|1:1"],

  // ---- Commerce ----
  ["shop-product", "Commerce", "Product photo — square", 2048, 2048, true, "product|shopify|store|ecommerce|e-commerce|catalog|listing|square|shop|pdp"],
  ["shop-product-portrait", "Commerce", "Product photo — portrait", 1600, 2000, false, "product|shopify|store|ecommerce|e-commerce|catalog|listing|portrait|4:5|fashion"],
  ["shop-collection", "Commerce", "Collection banner", 1800, 1000, false, "shopify|store|ecommerce|collection|category|banner|hero|plp"],
  ["shop-og", "Commerce", "Store link preview", 1200, 630, false, "shopify|store|ecommerce|open graph|og|link preview|social sharing"],
  ["amazon-main", "Commerce", "Amazon main image", 2000, 2000, true, "amazon|marketplace|listing|product|main image|hero image|zoom|square"],
  ["amazon-a-plus", "Commerce", "Amazon A+ module", 970, 600, false, "amazon|a+|a plus|enhanced brand content|ebc|module|product page"],
  ["etsy-listing", "Commerce", "Etsy listing photo", 2700, 2025, false, "etsy|listing|product|marketplace|shop|4:3|listing photo"],
  ["etsy-shop-banner", "Commerce", "Etsy big shop banner", 3360, 840, false, "etsy|shop banner|store banner|cover|header|4:1"],
  ["ebay-listing", "Commerce", "eBay listing photo", 1600, 1600, false, "ebay|listing|product|marketplace|main image|square"],
  ["ebay-billboard", "Commerce", "eBay store billboard", 1280, 290, false, "ebay|store|billboard|banner|cover|header"],
  ["walmart-product", "Commerce", "Walmart product image", 2000, 2000, false, "walmart|marketplace|listing|product|main image|square"],
  ["merchant-product", "Commerce", "Google Merchant product", 1200, 1200, false, "google merchant|merchant center|shopping ad|product feed|product image|square"],
  ["marketplace-landscape", "Commerce", "Marketplace lifestyle image", 1600, 1200, false, "marketplace|product|lifestyle image|secondary image|gallery|4:3"],
  ["product-detail", "Commerce", "Product detail close-up", 2000, 2500, false, "product|detail image|close up|feature image|pdp|portrait|4:5"],

  // ---- App stores ----
  ["appstore-icon", "App stores", "Apple App Store icon", 1024, 1024, true, "apple|app store|ios|iphone|ipad|app icon|store icon|1024"],
  ["appstore-iphone", "App stores", "iPhone screenshot — portrait", 1290, 2796, false, "apple|app store|ios|iphone|screenshot|portrait|phone screenshot"],
  ["appstore-ipad", "App stores", "iPad screenshot — portrait", 2048, 2732, false, "apple|app store|ios|ipad|screenshot|tablet|portrait"],
  ["play-icon", "App stores", "Google Play icon", 512, 512, true, "google play|play store|android|app icon|store icon|launcher icon"],
  ["play-feature", "App stores", "Google Play feature graphic", 1024, 500, false, "google play|play store|android|feature graphic|store banner|promo banner"],
  ["play-phone", "App stores", "Google Play phone screenshot", 1080, 1920, false, "google play|play store|android|phone screenshot|screenshot|portrait|9:16"],
  ["play-tv", "App stores", "Google TV banner", 1280, 720, false, "google play|android tv|google tv|tv banner|leanback|16:9"],

  // ---- Presentations & video ----
  ["slide-widescreen", "Presentations & video", "Presentation — widescreen", 1920, 1080, true, "presentation|slides|powerpoint|ppt|pptx|google slides|keynote|widescreen|16:9"],
  ["slide-standard", "Presentations & video", "Presentation — standard", 1024, 768, false, "presentation|slides|powerpoint|ppt|pptx|google slides|keynote|standard|4:3"],
  ["video-8k", "Presentations & video", "8K UHD video", 7680, 4320, false, "video|8k|uhd|4320p|16:9"],
  ["video-4k", "Presentations & video", "4K UHD video", 3840, 2160, true, "video|4k|uhd|2160p|16:9"],
  ["video-2k", "Presentations & video", "2K / QHD video", 2560, 1440, false, "video|2k|qhd|1440p|16:9"],
  ["video-1080", "Presentations & video", "Full HD video", 1920, 1080, true, "video|full hd|fhd|1080p|hd|16:9"],
  ["video-720", "Presentations & video", "HD video", 1280, 720, false, "video|hd|720p|16:9"],
  ["video-square", "Presentations & video", "Square video", 1080, 1080, false, "video|square video|social video|1:1"],
  ["video-vertical", "Presentations & video", "Vertical video", 1080, 1920, true, "video|vertical video|portrait video|mobile video|9:16|short form"],
  ["video-cinema", "Presentations & video", "DCI 4K cinema", 4096, 2160, false, "video|cinema|dci|4k cinema|scope|theatrical"],

  // ---- Print ----
  ["print-a3", "Print", "A3 at 300 dpi", 3508, 4961, false, "print|a3|page|poster|flyer|300dpi|dpi"],
  ["print-a4", "Print", "A4 at 300 dpi", 2480, 3508, true, "print|a4|page|poster|flyer|300dpi|dpi"],
  ["print-a5", "Print", "A5 at 300 dpi", 1748, 2480, false, "print|a5|flyer|leaflet|page|300dpi"],
  ["print-a6", "Print", "A6 at 300 dpi", 1240, 1748, false, "print|a6|postcard|flyer|leaflet|page|300dpi"],
  ["print-letter", "Print", "US Letter at 300 dpi", 2550, 3300, true, "print|letter|us letter|page|flyer|8.5x11|300dpi"],
  ["print-legal", "Print", "US Legal at 300 dpi", 2550, 4200, false, "print|legal|us legal|page|8.5x14|300dpi"],
  ["print-tabloid", "Print", "Tabloid / Ledger at 300 dpi", 3300, 5100, false, "print|tabloid|ledger|11x17|poster|newspaper|300dpi"],
  ["print-half-letter", "Print", "Half Letter at 300 dpi", 1650, 2550, false, "print|half letter|5.5x8.5|booklet|notebook|page|300dpi"],
  ["print-photo", "Print", "6 × 4 photo at 300 dpi", 1800, 1200, false, "print|photo|6x4|4x6|postcard|3:2|300dpi"],
  ["print-photo-5x7", "Print", "7 × 5 photo at 300 dpi", 2100, 1500, false, "print|photo|7x5|5x7|photo print|300dpi"],
  ["print-photo-8x10", "Print", "10 × 8 photo at 300 dpi", 3000, 2400, false, "print|photo|10x8|8x10|portrait print|300dpi"],
  ["print-card", "Print", "Business card at 300 dpi", 1050, 600, true, "print|business card|card|name card|3.5x2|300dpi"],
  ["print-card-bleed", "Print", "Business card with bleed", 1125, 675, false, "print|business card|card|name card|bleed|trim|3.75x2.25|300dpi"],
  ["print-postcard", "Print", "Postcard — 6 × 4", 1800, 1200, false, "print|postcard|mailer|direct mail|6x4|4x6|300dpi"],
  ["print-rack-card", "Print", "Rack card — 4 × 9", 1200, 2700, false, "print|rack card|dl flyer|4x9|tourism brochure|hotel rack|300dpi"],
  ["print-trifold", "Print", "Tri-fold brochure — Letter", 3300, 2550, false, "print|tri fold|trifold|brochure|letter landscape|folded leaflet|300dpi"],
  ["print-poster-18x24", "Print", "Poster — 18 × 24", 5400, 7200, false, "print|poster|18x24|large poster|300dpi"],
  ["print-poster-24x36", "Print", "Poster — 24 × 36", 7200, 10800, false, "print|poster|24x36|movie poster|large format|300dpi"],

  // ---- Podcast & music ----
  ["podcast-cover", "Podcast & music", "Podcast cover", 3000, 3000, true, "podcast|podcast cover|show art|cover art|apple podcasts|spotify podcast|square"],
  ["album-cover", "Podcast & music", "Album cover", 3000, 3000, true, "album|album cover|cover art|music|record|single cover|square"],
  ["spotify-canvas", "Podcast & music", "Spotify Canvas", 1080, 1920, false, "spotify|canvas|spotify canvas|vertical video|loop|9:16"],
  ["spotify-playlist", "Podcast & music", "Spotify playlist cover", 640, 640, false, "spotify|playlist|playlist cover|cover art|square"],
  ["soundcloud-profile", "Podcast & music", "SoundCloud profile picture", 1000, 1000, false, "soundcloud|profile|avatar|pfp|artist image|square"],
  ["soundcloud-header", "Podcast & music", "SoundCloud header", 2480, 520, false, "soundcloud|header|banner|cover|artist banner"],

  // ---- Events & calls ----
  ["zoom-background", "Events & calls", "Zoom virtual background", 1920, 1080, true, "zoom|virtual background|video call|meeting background|webcam background|16:9"],
  ["teams-background", "Events & calls", "Microsoft Teams background", 1920, 1080, false, "teams|microsoft teams|virtual background|meeting background|video call|16:9"],
  ["webinar-cover", "Events & calls", "Webinar cover", 1920, 1080, false, "webinar|virtual event|event cover|registration page|presentation cover|16:9"],
  ["eventbrite-cover", "Events & calls", "Event listing cover", 2160, 1080, false, "eventbrite|event|event cover|event listing|ticketing|2:1"],
  ["digital-signage", "Events & calls", "Digital signage — landscape", 1920, 1080, false, "digital signage|screen|display|tv graphic|menu board|landscape|16:9"],
];

export const PRESETS = RAW_PRESETS.map(
  ([id, group, name, w, h, hot, keywords]) =>
    enrichPreset({ id, group, name, w, h, hot, keywords }),
);

// Ratio shorthand people type directly. Each ratio maps to a concrete,
// practical canvas instead of an abstract shape.
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
  { ratio: 5 / 7, w: 1500, h: 2100 },
  { ratio: 7 / 5, w: 2100, h: 1500 },
  { ratio: 21 / 9, w: 2520, h: 1080 },
  { ratio: 32 / 9, w: 3840, h: 1080 },
  { ratio: 2 / 1, w: 1600, h: 800 },
  { ratio: 1 / 2, w: 1000, h: 2000 },
  { ratio: 3 / 1, w: 1800, h: 600 },
  { ratio: 4 / 1, w: 1600, h: 400 },
  { ratio: 5 / 2, w: 2000, h: 800 },
  { ratio: 1.91 / 1, w: 1200, h: 628 },
  { ratio: 1 / 1.91, w: 628, h: 1200 },
];

export const HOT = PRESETS.filter((preset) => preset.hot);