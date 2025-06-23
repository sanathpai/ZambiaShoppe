const adminRoutes=require('../routes/AdminRoutes');
const insightsRoutes = require('../routes/insightsRoutes');

app.use('/api/admin', adminRoutes);
app.use('/api/insights', insightsRoutes); 