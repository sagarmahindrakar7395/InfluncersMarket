import React, { useEffect, useState } from 'react'

const InstaAuthSucess = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState(null);
    const [igBusinessId, setIgBusinessId] = useState(null);
    const [postUrl, setPostUrl] = useState('');
    const [metrics, setMetrics] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        // Check for authentication code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            handleAuthCallback(code);
        }
    }, []);

    const handleAuthCallback = async (code) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:3000/auth/callback?code=${code}`);
            if (!response.ok) {
                throw new Error('Authentication failed');
            }
            const data = await response.json();
            setAccessToken(data.accessToken);
            setIgBusinessId(data.igBusinessId);
            setIsAuthenticated(true);
            // Clear the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            setError('Authentication failed. Please try again.');
            console.error('Auth error:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!postUrl) return;

        try {
            setLoading(true);
            setError(null);
            const response = await fetch('http://localhost:3000/api/post-metrics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    postUrl,
                    accessToken,
                    igBusinessId
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch post metrics');
            }
            
            const data = await response.json();
            setMetrics(data);
        } catch (error) {
            setError('Failed to fetch post metrics. Please check the URL and try again.');
            console.error('Metrics error:', error);
        } finally {
            setLoading(false);
        }
    };
  return (
    <div>

        heloooww
        <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={postUrl}
                            onChange={(e) => setPostUrl(e.target.value)}
                            placeholder="Paste Instagram post URL"
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-blue-400"
                    >
                        {loading ? 'Loading...' : 'Get Metrics'}
                    </button>
                </form>

                
            {metrics && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Post Metrics</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {metrics.data.map((metric) => (
                            <div key={metric.name} className="p-4 bg-white rounded shadow">
                                <h3 className="font-medium text-gray-700">{metric.name}</h3>
                                <p className="text-2xl font-bold text-blue-600">
                                    {metric.values[0].value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
    </div>
  )
}

export default InstaAuthSucess