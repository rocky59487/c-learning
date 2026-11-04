package app.aiefs.mobile;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import com.github.houbb.opencc4j.util.ZhTwConverterUtil;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * On-device zh-TW bridge for the original curriculum.
 * The upstream zh-TW language has a UI dictionary but no translated lesson markdown.
 * Reuses upstream zh lesson markdown where available; converts it to Taiwan Traditional.
 * Never rewrites code fences, API identifiers, URLs, syntax or mathematical notation.
 */
public final class LessonBridge {
    private static final String PREFIX = "/rohitg00/ai-engineering-from-scratch/translations/i18n/zh-TW/phases/";
    private static final String END = "/docs/zh-TW.md";
    private static final LinkedHashMap<String, String> TERMS = new LinkedHashMap<>();
    static {
        TERMS.put("檢索增強生成", "Retrieval-Augmented Generation (RAG)");
        TERMS.put("檢索增強的生成", "Retrieval-Augmented Generation (RAG)");
        TERMS.put("大型語言模型", "Large Language Model (LLM)");
        TERMS.put("多模態", "Multimodal");
        TERMS.put("機器學習", "Machine Learning (ML)");
        TERMS.put("深度學習", "Deep Learning");
        TERMS.put("自然語言處理", "Natural Language Processing (NLP)");
        TERMS.put("神經網路", "Neural Network");
        TERMS.put("注意力機制", "Attention Mechanism");
        TERMS.put("自注意力", "Self-Attention");
        TERMS.put("位置編碼", "Positional Encoding");
        TERMS.put("梯度下降", "Gradient Descent");
        TERMS.put("反向傳播", "Backpropagation");
        TERMS.put("嵌入向量", "Embedding");
        TERMS.put("嵌入模型", "Embedding Model");
        TERMS.put("向量資料庫", "Vector Database");
        TERMS.put("向量搜尋", "Vector Search");
        TERMS.put("語義搜尋", "Semantic Search");
        TERMS.put("提示工程", "Prompt Engineering");
        TERMS.put("提示詞工程", "Prompt Engineering");
        TERMS.put("微調", "Fine-tuning");
        TERMS.put("低秩適應", "Low-Rank Adaptation (LoRA)");
        TERMS.put("函式呼叫", "Function Calling");
        TERMS.put("工具呼叫", "Tool Calling");
        TERMS.put("情境工程", "Context Engineering");
        TERMS.put("上下文工程", "Context Engineering");
        TERMS.put("模型上下文協定", "Model Context Protocol (MCP)");
        TERMS.put("模型上下文協議", "Model Context Protocol (MCP)");
        TERMS.put("智能體", "AI Agent");
        TERMS.put("人工智慧代理", "AI Agent");
        TERMS.put("代理執行環境", "Agent Runtime");
        TERMS.put("評估指標", "Evaluation Metrics");
        TERMS.put("損失函式", "Loss Function");
        TERMS.put("權重衰減", "Weight Decay");
        TERMS.put("強化學習", "Reinforcement Learning (RL)");
        TERMS.put("檢索器", "Retriever");
        TERMS.put("重新排序", "Reranking");
    }

    public static String glossary() {
        StringBuilder b = new StringBuilder("課程保留 Python、API、CLI、LLM、RAG、MCP、LoRA、模型名稱及程式碼原文。\n\n");
        for (Map.Entry<String,String> e : TERMS.entrySet()) {
            b.append(e.getKey()).append("  —  ").append(e.getValue()).append("\n");
        }
        b.append("\n來源：原作者公開中文翻譯；非官方、未經逐課人工校對。");
        return b.toString();
    }

    public static boolean matches(WebResourceRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) return false;
        Uri u = request.getUrl();
        return "https".equalsIgnoreCase(u.getScheme())
            && "raw.githubusercontent.com".equalsIgnoreCase(u.getHost())
            && u.getPath() != null && u.getPath().startsWith(PREFIX) && u.getPath().endsWith(END);
    }

    public static WebResourceResponse intercept(Uri uri, File cacheDir) {
        try {
            File dir = new File(cacheDir, "zh-tw-lessons");
            if (!dir.exists() && !dir.mkdirs()) return null;
            String req = uri.toString();
            File cache = new File(dir, digest(req) + ".md");
            String translated = null;

            // Prefer upstream freshness, but use a successful local copy when offline.
            try {
                String src = req.replace("/i18n/zh-TW/", "/i18n/zh/")
                    .replace("/docs/zh-TW.md", "/docs/zh.md");
                translated = toTraditional(fetchText(src));
                byte[] data = translated.getBytes(StandardCharsets.UTF_8);
                try (FileOutputStream out = new FileOutputStream(cache)) { out.write(data); }
            } catch (Exception networkError) {
                if (cache.isFile()) {
                    try (InputStream in = new FileInputStream(cache)) {
                        translated = new String(readAll(in), StandardCharsets.UTF_8);
                    }
                }
            }
            if (translated == null || translated.isEmpty()) return null;
            Map<String,String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Content-Type", "text/plain; charset=utf-8");
            headers.put("Cache-Control", "private, max-age=3600");
            return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", headers,
                new ByteArrayInputStream(translated.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            return null; // Original site gracefully falls back to the English lesson.
        }
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
            if (out.size() + n > 4 * 1024 * 1024) throw new java.io.IOException("Lesson exceeds 4MB");
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static String fetchText(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(9000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("User-Agent", "AIEngineeringAndroid-zhTW/1.1");
        connection.setInstanceFollowRedirects(false);
        try {
            if (connection.getResponseCode() != 200) throw new java.io.IOException("Missing source translation");
            try (InputStream in = connection.getInputStream()) {
                return new String(readAll(in), StandardCharsets.UTF_8);
            }
        } finally { connection.disconnect(); }
    }

    private static String digest(String text) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < 16; i++) result.append(String.format(java.util.Locale.ROOT, "%02x", hash[i] & 255));
        return result.toString();
    }

    private static String toTraditional(String markdown) {
        Set<String> seen = new HashSet<>();
        String[] lines = markdown.split("\\n", -1);
        StringBuilder out = new StringBuilder(markdown.length() + 1024);
        boolean fenced = false, math = false;
        for (int i=0; i<lines.length; i++) {
            String line = lines[i];
            String t = line.trim();
            if (t.startsWith("```") || t.startsWith("~~~")) {
                fenced = !fenced;
            } else if (!fenced && t.startsWith("$$")) {
                math = !math;
            } else if (!fenced && !math && !t.startsWith("\\[") && !t.startsWith("\\]")) {
                line = ZhTwConverterUtil.toTraditional(line);
                // Keep canonical English technical vocabulary visible at the first occurrence.
                for (Map.Entry<String,String> entry : TERMS.entrySet()) {
                    String cn = entry.getKey();
                    String en = entry.getValue();
                    if (seen.contains(en) || !line.contains(cn)) continue;
                    seen.add(en);
                    if (line.contains(en)) continue;
                    line = line.replaceFirst(java.util.regex.Pattern.quote(cn),
                        java.util.regex.Matcher.quoteReplacement(cn + "（" + en + "）"));
                }
            }
            out.append(line);
            if (i != lines.length - 1) out.append('\n');
        }
        return out.toString();
    }
}
