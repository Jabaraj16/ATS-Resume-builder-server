const fs = require('fs');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');

// Heuristic to classify sections
const identifySections = (text) => {
    const sections = {
        summary: ['summary', 'profile', 'objective', 'about me', 'professional summary'],
        experience: ['experience', 'work history', 'employment', 'work experience', 'professional experience'],
        education: ['education', 'academic', 'qualifications', 'credentials', 'academic background'],
        skills: ['skills', 'technologies', 'technical skills', 'core competencies', 'expertise', 'technical proficiency']
    };

    const lines = text.split('\n');
    const sectionIndices = [];

    // Find potential headers
    lines.forEach((line, index) => {
        const lowerLine = line.trim().toLowerCase();
        // Header heuristic: short, contains keyword, maybe uppercase
        if (lowerLine.length < 40 && lowerLine.length > 2) {
            for (const [type, keywords] of Object.entries(sections)) {
                if (keywords.some(k => lowerLine.includes(k))) {
                    sectionIndices.push({ type, index, line: line.trim() });
                    break;
                }
            }
        }
    });

    // Sort by index
    sectionIndices.sort((a, b) => a.index - b.index);
    return sectionIndices;
};

const extractSectionText = (text, sectionType, indices) => {
    const startObj = indices.find(s => s.type === sectionType);
    if (!startObj) return '';

    const startObjIndex = indices.indexOf(startObj);
    const nextObj = indices[startObjIndex + 1];

    const lines = text.split('\n');
    const startLine = startObj.index + 1;
    const endLine = nextObj ? nextObj.index : lines.length;

    return lines.slice(startLine, endLine).join('\n').trim();
};

const parseResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const dataBuffer = fs.readFileSync(req.file.path);

        // 1. Extract Text
        let text = '';
        try {
            const pdfData = await pdf(dataBuffer);
            text = pdfData.text;
        } catch (err) {
            console.error('PDF Parse Error:', err);
            return res.status(500).json({ message: 'Failed to parse PDF' });
        }

        // 2. Cleanup
        // Remove file after read (if we want to save space, assuming temp upload)
        // fs.unlinkSync(req.file.path); 

        // 3. OCR Fallback Check
        if (text.trim().length < 50) {
            // Very little text, likely scanned.
            // NOTE: Tesseract.js works on images. Using it on PDF buffer directly isn't standard in Node
            // without converting to image first (e.g. using pdf-poppler or canvas).
            // For this environment, we might skip full OCR if we lack system deps, 
            // but let's assume we return a warning or try best effort if possible.
            // For now, we will return a specific flag or message.
            console.log("Scanned PDF detected. Text extraction low.");
            // We can return here or attempt sophisticated OCR if we had image conversion.
            // Let's assume we proceed with what we have or return empty.
        }

        // 4. Structure Data
        const indices = identifySections(text);

        const resume = {
            personalInfo: {},
            summary: extractSectionText(text, 'summary', indices),
            experience: [],
            education: [],
            skills: []
        };

        // --- Personal Info Extraction ---
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
        const phoneRegex = /(\+?\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

        const emailMatch = text.match(emailRegex);
        if (emailMatch) resume.personalInfo.email = emailMatch[0];

        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch) resume.personalInfo.phone = phoneMatch[0];

        // Name Heuristic: First non-empty line
        const nonEmptyLines = text.split('\n').filter(l => l.trim().length > 0);
        if (nonEmptyLines.length > 0) {
            const first = nonEmptyLines[0].trim();
            if (!first.toLowerCase().includes('resume')) {
                resume.personalInfo.fullName = first;
            }
        }

        // --- Skills Extraction ---
        const skillsText = extractSectionText(text, 'skills', indices);
        const commonSkills = ['React', 'JavaScript', 'Python', 'Java', 'Node.js', 'CSS', 'HTML', 'SQL', 'Git', 'AWS', 'Docker', 'Kubernetes', 'C++', 'C#', 'Go', 'Rust', 'TypeScript', 'Angular', 'Vue', 'MongoDB', 'PostgreSQL', 'Express', 'Django', 'Flask', 'Spring Boot'];

        const foundSkills = new Set();
        // Check entire text for keywords
        commonSkills.forEach(skill => {
            if (text.toLowerCase().includes(skill.toLowerCase())) {
                foundSkills.add(skill);
            }
        });
        // Check skills section for comma-separated list
        if (skillsText) {
            const potentialSkills = skillsText.split(/[,•\n]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 25);
            potentialSkills.forEach(s => foundSkills.add(s));
        }
        resume.skills = Array.from(foundSkills).slice(0, 20); // Limit to 20

        // --- Experience Parsing ---
        const expText = extractSectionText(text, 'experience', indices);
        if (expText) {
            // Split by double newlines or long gaps
            const blocks = expText.split(/\n\s*\n/).filter(b => b.trim().length > 20);
            resume.experience = blocks.map(block => {
                const lines = block.split('\n').map(l => l.trim()).filter(l => l);
                return {
                    company: lines[0] || 'Unknown Company',
                    position: lines[1] || 'Role',
                    startDate: '',
                    endDate: '',
                    description: lines.slice(2).join('\n')
                };
            });
        }

        // --- Education Parsing ---
        const eduText = extractSectionText(text, 'education', indices);
        if (eduText) {
            const blocks = eduText.split(/\n\s*\n/).filter(b => b.trim().length > 10);
            resume.education = blocks.map(block => {
                const lines = block.split('\n').map(l => l.trim()).filter(l => l);
                return {
                    school: lines[0] || 'Unknown School',
                    degree: lines[1] || 'Degree',
                    startDate: '',
                    endDate: ''
                };
            });
        }

        res.json(resume);

    } catch (error) {
        console.error('Resume Parse Error:', error);
        res.status(500).json({
            message: 'Server error during parsing',
            error: error.message,
            stack: error.stack
        });
    }
};

const uploadPhoto = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        // Construct URL (assuming server runs on localhost:5000)
        // In production, use env var for base URL
        const protocol = req.protocol;
        const host = req.get('host');
        const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        res.json({ imageUrl });
    } catch (error) {
        console.error('Photo Upload Error:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
};

module.exports = { parseResume, uploadPhoto };
