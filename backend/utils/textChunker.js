
/**
 * Split text into chunks for better AI processing.
 * @param {string} text - Full text to chunk
 * @param {number} chunkSize - Target number of words per chunk
 * @param {number} overlap - Number of words shared between chunks
 * @returns {Array<{content: string, chunkIndex: number, pageNumber: number}>}
 */
export const chunkText = (text, chunkSize = 500, overlap = 50) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
        return [];
    }

    // Validate chunk settings
    chunkSize = Math.floor(chunkSize);
    overlap = Math.floor(overlap);

    if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
        throw new Error('Invalid chunkSize or overlap values');
    }

    // Clean text while preserving paragraph boundaries
    const cleanedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim();

    const paragraphs = cleanedText
        .split(/\n+/)
        .filter(paragraph => paragraph.trim().length > 0);

    const chunks = [];
    let currentWords = [];

    const saveChunk = (words) => {
        if (words.length === 0) return;

        chunks.push({
            content: words.join(' '),
            chunkIndex: chunks.length,
            pageNumber: 0
        });
    };

    for (const paragraph of paragraphs) {
        const words = paragraph.trim().split(/\s+/);

        // Split paragraphs that are larger than chunkSize
        if (words.length > chunkSize) {
            if (currentWords.length > 0) {
                saveChunk(currentWords);
                currentWords = [];
            }

            for (let i = 0; i < words.length; i += chunkSize - overlap) {
                const chunkWords = words.slice(i, i + chunkSize);
                saveChunk(chunkWords);

                if (i + chunkSize >= words.length) {
                    break;
                }
            }

            continue;
        }

        // If the paragraph does not fit, save the current chunk
        if (currentWords.length + words.length > chunkSize) {
            saveChunk(currentWords);

            // Carry the last few words into the next chunk
            currentWords = currentWords.slice(-overlap);
        }

        currentWords.push(...words);
    }

    // Save any remaining words
    if (currentWords.length > 0) {
        saveChunk(currentWords);
    }

    return chunks;
};


/**
 * Find relevant chunks based on a search query.
 * @param {Array<Object>} chunks - Array of text chunks
 * @param {string} query - User's search query
 * @param {number} maxChunks - Maximum number of results
 * @returns {Array<Object>}
 */
export const findRelevantChunks = (chunks, query, maxChunks = 3) => {
    if (!Array.isArray(chunks) || chunks.length === 0 || !query?.trim()) {
        return [];
    }

    const stopWords = new Set([
        'the', 'is', 'in', 'and', 'to', 'of', 'a', 'that', 'it', 'on',
        'for', 'with', 'as', 'this', 'by', 'an', 'be', 'are', 'from',
        'or', 'at', 'which', 'but', 'not', 'have', 'has', 'was', 'were'
    ]);

    // Normalize query and remove stop words
    const queryWords = query
        .toLowerCase()
        .match(/[a-z0-9]+/g) || [];

    const filteredQueryWords = [...new Set(
        queryWords.filter(word => word.length > 2 && !stopWords.has(word))
    )];

    maxChunks = Math.max(1, Math.floor(maxChunks));

    // If no useful query words remain, return the first chunks
    if (filteredQueryWords.length === 0) {
        return chunks.slice(0, maxChunks).map(chunk => ({
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            _id: chunk._id
        }));
    }

    const scoredChunks = chunks.map((chunk, index) => {
        const contentWords = (chunk.content.toLowerCase().match(/[a-z0-9]+/g)) || [];
        const wordCounts = {};

        // Count the frequency of each word in the chunk
        for (const word of contentWords) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }

        let score = 0;
        let matchedWords = 0;

        // Score each query word
        for (const word of filteredQueryWords) {
            const frequency = wordCounts[word] || 0;

            if (frequency > 0) {
                matchedWords++;
                score += frequency * 3;
            }
        }

        // Give a bonus when multiple query words are found
        if (matchedWords > 1) {
            score += matchedWords * 2;
        }

        // Normalize score to avoid favoring longer chunks
        const normalizedScore = score / Math.sqrt(Math.max(contentWords.length, 1));

        // Slightly prefer earlier chunks when scores are equal
        const positionBonus = 1 - (index / chunks.length) * 0.1;

        return {
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            _id: chunk._id,
            score: normalizedScore * positionBonus,
            rawScore: score,
            matchedWords
        };
    });

    return scoredChunks
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }

            if (b.matchedWords !== a.matchedWords) {
                return b.matchedWords - a.matchedWords;
            }

            return a.chunkIndex - b.chunkIndex;
        })
        .slice(0, maxChunks);
};
