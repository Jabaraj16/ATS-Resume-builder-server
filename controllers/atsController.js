const jobKeywords = {
    'general': {
        found: ['Communication', 'Teamwork', 'Problem Solving', 'Time Management'],
        missing: ['Leadership', 'Project Management', 'Adaptability']
    },
    'frontend': {
        found: ['React', 'JavaScript', 'CSS', 'HTML', 'Responsive Design'],
        missing: ['TypeScript', 'Testing', 'Performance Optimization', 'Git']
    },
    'backend': {
        found: ['Node.js', 'API Design', 'Database', 'SQL', 'Security'],
        missing: ['Docker', 'Kubernetes', 'Microservices', 'AWS']
    },
    'mobile': {
        found: ['React Native', 'iOS', 'Android', 'API Integration'],
        missing: ['Flutter', 'Publishing', 'Performance', 'Swift']
    },
    'data': {
        found: ['Python', 'SQL', 'Data Analysis', 'Visualization', 'Statistics'],
        missing: ['Machine Learning', 'Big Data', 'Tableau', 'Spark']
    },
    'design': {
        found: ['Figma', 'UI/UX', 'Prototyping', 'Wireframing', 'Color Theory'],
        missing: ['lo-fi', 'User Research', 'Adobe Suite', 'Interaction Design']
    },
    'business': {
        found: ['Analysis', 'Reporting', 'Excel', 'Stakeholder Management'],
        missing: ['Strategy', 'Budgeting', 'KPIs', 'Agile']
    },
    'marketing': {
        found: ['SEO', 'Content Strategy', 'Social Media', 'Analytics'],
        missing: ['Copywriting', 'Email Marketing', 'PPC', 'Brand Management']
    },
    'sales': {
        found: ['CRM', 'Negotiation', 'Lead Generation', 'Communication'],
        missing: ['Closing', 'Prospecting', 'Salesforce', 'Account Management']
    },
    'hr': {
        found: ['Recruitment', 'Onboarding', 'Communication', 'Employee Relations'],
        missing: ['Compliance', 'Payroll', 'Training', 'Benefits']
    },
    'finance': {
        found: ['Excel', 'Financial Analysis', 'Reporting', 'Accounting'],
        missing: ['Forecasting', 'Auditing', 'GAAP', 'Risk Management']
    },
    'engineering': {
        found: ['Project Management', 'CAD', 'Technical Writing', 'Problem Solving'],
        missing: ['Safety Standards', 'Quality Control', 'Testing', 'Simulation']
    },
    'support': {
        found: ['Troubleshooting', 'Customer Service', 'Windows', 'Hardware'],
        missing: ['Network Security', 'Active Directory', 'Documentation']
    }
};

exports.analyzeResume = (req, res) => {
    try {
        const { jobRole } = req.body;
        // In a real AI implementation, we would parse the PDF file here.
        // For now, we simulate the analysis using our keyword database.

        const roleData = jobKeywords[jobRole] || jobKeywords['general'];
        const baseScore = Math.floor(Math.random() * (95 - 70) + 70);

        res.json({
            success: true,
            data: {
                score: baseScore,
                keywords: roleData.found,
                missing: roleData.missing,
                formatting: 'Good'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Analysis failed' });
    }
};
