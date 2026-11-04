package app.aiefs.mobile;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Menu;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String HOME = "https://aiengineeringfromscratch.com/";
    private WebView web;
    private ProgressBar progress;
    private FrameLayout frame;
    private LinearLayout errorPanel;
    private boolean pageError;

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    private Button action(String text, String description) {
        Button b = new Button(this);
        b.setText(text);
        b.setContentDescription(description);
        b.setTextSize(20);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setAllCaps(false);
        b.setMinWidth(dp(44));
        b.setPadding(0,0,0,0);
        return b;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(17,21,27));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        setContentView(root);
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(12),0,dp(6),0);
        bar.setBackgroundColor(Color.rgb(17,21,27));
        root.addView(bar, new LinearLayout.LayoutParams(-1,dp(50)));
        TextView title = new TextView(this);
        title.setText("AI / FROM SCRATCH");
        title.setTextColor(Color.WHITE);
        title.setTextSize(13);
        title.setTypeface(null,1);
        title.setGravity(Gravity.CENTER_VERTICAL);
        bar.addView(title,new LinearLayout.LayoutParams(0,-1,1));
        title.setOnClickListener(v -> web.loadUrl(HOME));
        Button refresh=action("↻","重新整理");
        bar.addView(refresh,new LinearLayout.LayoutParams(dp(46),-1));
        refresh.setOnClickListener(v -> web.reload());
        Button more=action("⋮","更多選項");
        bar.addView(more,new LinearLayout.LayoutParams(dp(46),-1));
        more.setOnClickListener(this::showMenu);
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress,new LinearLayout.LayoutParams(-1,dp(2)));
        frame=new FrameLayout(this);
        root.addView(frame,new LinearLayout.LayoutParams(-1,0,1));
        web=new WebView(this);
        frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT>=26) s.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v,int p) {
                progress.setProgress(p);
                progress.setVisibility(p>=100?View.INVISIBLE:View.VISIBLE);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r) {
                Uri u=r.getUrl();
                String host=u.getHost();
                if("https".equalsIgnoreCase(u.getScheme()) && host!=null &&
                   (host.equalsIgnoreCase("aiengineeringfromscratch.com") ||
                    host.equalsIgnoreCase("www.aiengineeringfromscratch.com"))) return false;
                if(r.isForMainFrame()) external(u);
                return true;
            }
            @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon) {
                pageError=false; showError(false);
            }
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e) {
                if(r.isForMainFrame()) { pageError=true; showError(true); }
            }
            @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse e) {
                if(r.isForMainFrame() && e.getStatusCode()>=400) { pageError=true; showError(true); }
            }
            @Override public void onPageFinished(WebView v,String url) {
                if(!pageError) showError(false);
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,length)->{
            Uri u=Uri.parse(url);
            if(!"https".equalsIgnoreCase(u.getScheme())) return;
            if(Build.VERSION.SDK_INT<29) {external(u);return;}
            try{
                String name=URLUtil.guessFileName(url,disposition,mime);
                DownloadManager.Request req=new DownloadManager.Request(u);
                req.setTitle(name);
                req.setMimeType(mime);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,name);
                ((DownloadManager)getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(req);
                Toast.makeText(this,"開始下載",Toast.LENGTH_SHORT).show();
            }catch(Exception ex){external(u);}
        });
        makeError();
        if(state==null) web.loadUrl(HOME);
        else web.restoreState(state);
    }

    private String url(){
        String u=web.getUrl();
        return u==null || !u.startsWith("https://") ? HOME : u;
    }
    private void external(Uri u){
        if(u==null)return;
        String s=u.getScheme();
        if(s==null|| !(s.equalsIgnoreCase("https")||s.equalsIgnoreCase("http")||s.equalsIgnoreCase("mailto")))return;
        try{startActivity(new Intent(Intent.ACTION_VIEW,u));}
        catch(Exception e){Toast.makeText(this,"無法開啟連結",Toast.LENGTH_SHORT).show();}
    }
    private void showMenu(View button) {
        PopupMenu p=new PopupMenu(this,button);
        p.getMenu().add(Menu.NONE,1,0,"課程首頁");
        p.getMenu().add(Menu.NONE,2,1,"上一頁");
        p.getMenu().add(Menu.NONE,3,2,"下一頁");
        p.getMenu().add(Menu.NONE,4,3,"在瀏覽器開啟");
        p.getMenu().add(Menu.NONE,5,4,"分享頁面");
        p.setOnMenuItemClickListener(item->{
            switch(item.getItemId()){
                case 1:web.loadUrl(HOME);return true;
                case 2:if(web.canGoBack())web.goBack();return true;
                case 3:if(web.canGoForward())web.goForward();return true;
                case 4:external(Uri.parse(url()));return true;
                case 5:
                    Intent i=new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT,url());
                    startActivity(Intent.createChooser(i,"分享課程"));
                    return true;
            }
            return false;
        });
        p.show();
    }
    private void makeError(){
        errorPanel=new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24),dp(24),dp(24),dp(24));
        errorPanel.setBackgroundColor(Color.WHITE);
        TextView t=new TextView(this);
        t.setText("無法載入課程\n檢查網路後重新整理");
        t.setGravity(Gravity.CENTER);
        t.setTextColor(Color.DKGRAY);
        t.setTextSize(17);
        errorPanel.addView(t);
        Button b=new Button(this);
        b.setText("重新載入");
        b.setOnClickListener(v->web.reload());
        errorPanel.addView(b);
        frame.addView(errorPanel,new FrameLayout.LayoutParams(-1,-1));
        showError(false);
    }
    private void showError(boolean show){
        if(errorPanel!=null)errorPanel.setVisibility(show?View.VISIBLE:View.GONE);
    }
    @Override public void onBackPressed(){
        if(web!=null && web.canGoBack())web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle b){
        if(web!=null)web.saveState(b);
        super.onSaveInstanceState(b);
    }
    @Override protected void onPause(){super.onPause();if(web!=null)web.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){
        if(web!=null){web.stopLoading();web.destroy();web=null;}
        super.onDestroy();
    }
}
