// backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const FACEBOOK_GRAPH_API = 'https://graph.facebook.com/v18.0';

const instagramConfig = {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
};

const permissions = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_read_engagement',
    'pages_show_list'
].join(',');

app.get('/auth/instagram', (req, res) => {
    try {
        const loginUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${instagramConfig.appId}&redirect_uri=${encodeURIComponent(instagramConfig.redirectUri)}&scope=${encodeURIComponent(permissions)}&response_type=code`;
        res.json({ url: loginUrl });
    } catch (error) {
        console.error('Login URL generation error:', error);
        res.status(500).json({ error: 'Failed to generate login URL' });
    }
});

app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code is missing!' });
    }

    try {
        const tokenResponse = await axios.get(`${FACEBOOK_GRAPH_API}/oauth/access_token`, {
            params: {
                client_id: instagramConfig.appId,
                client_secret: instagramConfig.appSecret,
                redirect_uri: instagramConfig.redirectUri,
                code: code
            }
        });

        const accessToken = tokenResponse.data.access_token;

        const accountResponse = await axios.get(`${FACEBOOK_GRAPH_API}/me/accounts`, {
            params: { 
                access_token: accessToken,
                fields: 'id,name,instagram_business_account'
            }
        });

        if (!accountResponse.data.data || accountResponse.data.data.length === 0) {
            throw new Error('No Facebook pages found');
        }

        const page = accountResponse.data.data[0];
        if (!page.instagram_business_account) {
            throw new Error('No Instagram business account found');
        }

        const igBusinessId = page.instagram_business_account.id;

        res.json({
            accessToken,
            igBusinessId
        });
        
    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

app.post('/api/post-metrics', async (req, res) => {
    const { postUrl, accessToken, igBusinessId } = req.body;

    if (!postUrl || !accessToken || !igBusinessId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const shortcode = extractShortcode(postUrl);
        if (!shortcode) {
            return res.status(400).json({ error: 'Invalid Instagram post URL' });
        }

        // First get all media to find matching shortcode
        const mediaResponse = await axios.get(`${FACEBOOK_GRAPH_API}/${igBusinessId}/media`, {
            params: {
                access_token: accessToken,
                fields: 'id,shortcode'
            }
        });

        const mediaItem = mediaResponse.data.data.find(item => 
            item.shortcode === shortcode
        );

        if (!mediaItem) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Fetch specific media metrics
        const metricsResponse = await axios.get(`${FACEBOOK_GRAPH_API}/${mediaItem.id}`, {
            params: {
                access_token: accessToken,
                fields: 'like_count,comments_count,media_type'
            }
        });

        res.json(metricsResponse.data);
    } catch (error) {
        console.error('Metrics error:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || 'Failed to fetch post metrics' });
    }
});


app.post('/api/search-account', async (req, res) => {
    const { username, accessToken, igBusinessId } = req.body;

    if (!username || !accessToken || !igBusinessId) {
        return res.status(400).json({ error: 'Username, access token, and Instagram business ID are required' });
    }

    try {
        // Make the API request with the correct fields parameter format
        const response = await axios.get(`${FACEBOOK_GRAPH_API}/${igBusinessId}`, {
            params: {
                fields: `business_discovery.username(${username}){username,profile_picture_url,followers_count,follows_count,media_count,biography,website,name,media{id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count}}`,
                access_token: accessToken
            }
        });

        // Extract the business_discovery data from the response
        const userData = response.data.business_discovery;
        
        res.json({
            success: true,
            user: {
                username: userData.username,
                profilePicture: userData.profile_picture_url,
                followersCount: userData.followers_count,
                followsCount: userData.follows_count,
                mediaCount: userData.media_count,
                biography: userData.biography,
                website: userData.website,
                name: userData.name
            },
            media: userData.media?.data || []
        });

      
        

    } catch (error) {
        console.error('Instagram API Error:', error.response?.data || error);
        
        if (error.response?.data?.error) {
            const igError = error.response.data.error;
            
            switch (igError.code) {
                case 190:
                    return res.status(401).json({ 
                        error: 'Authentication error',
                        details: 'Your access token is invalid or has expired'
                    });
                case 24:
                    return res.status(429).json({ 
                        error: 'Rate limit exceeded',
                        details: 'Too many requests. Please try again later'
                    });
                case 4:
                    return res.status(403).json({ 
                        error: 'Permissions error',
                        details: 'The app needs additional permissions'
                    });
                case 100:
                    return res.status(400).json({ 
                        error: 'Invalid request',
                        details: igError.message
                    });
                default:
                    return res.status(500).json({ 
                        error: 'Instagram API error',
                        details: igError.message 
                    });
            }
        }

        res.status(500).json({ 
            error: 'Failed to fetch Instagram data',
            details: error.message 
        });
    }
});

function extractShortcode(url) {
    try {
        const match = url.match(/\/p\/([^/?]+)/);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});