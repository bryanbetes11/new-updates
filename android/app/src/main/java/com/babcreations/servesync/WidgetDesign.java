package com.babcreations.servesync;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.appwidget.AppWidgetManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Calendar;
import java.util.TimeZone;
import java.util.LinkedHashMap;

/** The editor and launcher use this same renderer; draft settings never touch storage. */
final class WidgetDesign {
    // Decorative-only, bounded cache: no member or church content is rasterized here.
    private static final LinkedHashMap<String,Bitmap> PHOTO_CACHE=new LinkedHashMap<>();
    private static synchronized Bitmap photo(Context c,float width,float height){
        float ratio=Math.min(1,512f/Math.max(width,height));
        int w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
        String key=w+"x"+h;Bitmap cached=PHOTO_CACHE.get(key);if(cached!=null)return cached;
        Bitmap source=BitmapFactory.decodeResource(c.getResources(),R.drawable.widget_art_signal);
        Bitmap result=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);result.setDensity(Bitmap.DENSITY_NONE);
        Canvas canvas=new Canvas(result);Path outline=new Path();float radius=26*ratio;
        outline.addRoundRect(new RectF(0,0,w,h),new float[]{radius,radius,radius,radius,0,0,0,0},Path.Direction.CW);canvas.clipPath(outline);
        float crop=Math.max((float)w/source.getWidth(),(float)h/source.getHeight());
        float drawnW=source.getWidth()*crop,drawnH=source.getHeight()*crop;
        canvas.drawBitmap(source,new Rect(0,0,source.getWidth(),source.getHeight()),new RectF((w-drawnW)/2,(h-drawnH)/2,(w+drawnW)/2,(h+drawnH)/2),new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG));
        source.recycle();if(PHOTO_CACHE.size()>=8)PHOTO_CACHE.remove(PHOTO_CACHE.keySet().iterator().next());PHOTO_CACHE.put(key,result);return result;
    }
    static final String[] KEYS = {"kind", "style", "theme", "accent", "event", "motion", "density", "text", "art", "details", "branding", "week"};
    static String value(Context c, int id, Bundle draft, String key, String fallback) {
        return ServeSyncWidgetProvider.option(c, id, draft, key, fallback);
    }
    static int accent(String name, boolean signal) {
        return Color.parseColor(name.equals("blue") ? "#3984FF" : name.equals("violet") ? "#B884FF" : name.equals("emerald") ? "#35C79A" : name.equals("amber") ? "#E6B632" : name.equals("coral") ? "#FF502B" : name.equals("lime") ? "#CCFF00" : signal ? "#CCFF00" : "#FF502B");
    }
    static boolean signal(String style) { return style.equals("signal") || style.equals("bold"); }
    static int badgeInk(String name, boolean signal) {
        return name.equals("coral") || name.equals("auto")&&!signal ? Color.WHITE : Color.BLACK;
    }
    static int badge(String name, boolean signal) {
        switch(name) {
            case "coral": return R.drawable.widget_badge_coral;
            case "lime": return R.drawable.widget_badge_lime;
            case "blue": return R.drawable.widget_badge_blue;
            case "violet": return R.drawable.widget_badge_violet;
            case "emerald": return R.drawable.widget_badge_emerald;
            case "amber": return R.drawable.widget_badge_amber;
            default: return signal?R.drawable.widget_badge_signal:R.drawable.widget_badge_paper;
        }
    }
    static int dp(Context c, float n) { return Math.round(n * c.getResources().getDisplayMetrics().density); }
    static void text(RemoteViews v, int id, String s, int color, float size) {
        v.setTextViewText(id, s); v.setTextColor(id, color); v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, size);
    }
    static RemoteViews render(Context c, int id, float w, float h, Bundle draft) {
        String kind = value(c,id,draft,"kind",ServeSyncWidgetProvider.defaultKind(c,id));
        boolean signal = signal(value(c,id,draft,"style","paper"));
        String theme = value(c,id,draft,"theme","design");
        boolean dark = theme.equals("dark") || theme.equals("design") && signal && !kind.equals("schedule") && !kind.equals("quick") || theme.equals("system") && (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int ink = Color.parseColor(dark ? "#F7F7F3" : "#111317"), muted = Color.parseColor(dark ? "#B8B9B4" : "#60656E");
        int accent = accent(value(c,id,draft,"accent","auto"),signal);
        boolean strip=h<120, narrow=w<120;
        float scale = value(c,id,draft,"text","default").equals("large") ? 1.15f : value(c,id,draft,"text","default").equals("small") ? .9f : 1f;
        float fontScale=c.getResources().getConfiguration().fontScale;
        boolean largeType=scale*fontScale>1.15f;
        String density = value(c,id,draft,"density","balanced");
        int pad = narrow || strip ? 8 : density.equals("compact") ? 12 : density.equals("roomy") ? 22 : 17;
        boolean details=value(c,id,draft,"details","on").equals("on");
        JSONObject data=WidgetStore.snapshot(c);
        boolean has=data.has("updatedAt");
        List<JSONObject> cards=ServeSyncWidgetProvider.cards(data,kind,value(c,id,draft,"event",""));
        String feed=kind.equals("news")?"announcements":kind.equals("setlist")?"setlists":kind.equals("pending")?"pending":"assignments";
        boolean unavailable=data.optJSONArray("unavailable")!=null && data.optJSONArray("unavailable").toString().contains("\""+feed+"\"");
        boolean empty=cards.isEmpty();
        if(empty) {
            String message=WidgetStore.scope(c).isEmpty()?"Sign in to ServeSync":!has?"Open app to refresh":unavailable?"Could not refresh":kind.equals("pending")?"All caught up":kind.equals("setlist")?"No approved setlist":kind.equals("news")?"No announcements yet":"No upcoming assignments";
            cards.add(ServeSyncWidgetProvider.card(message,"Tap to open ServeSync","Your church, at a glance",ServeSyncWidgetProvider.defaultRoute(kind)));
        }
        boolean hero=kind.equals("next")||kind.equals("pending")||kind.equals("news")||empty;
        boolean editorial=kind.equals("next")&&!empty&&(w>=240&&h>=200||signal&&w>=140&&h>=170);
        boolean pendingHero=kind.equals("pending")&&!empty&&has&&!unavailable&&!strip&&w>=120&&h>=180;
        boolean photoHero=kind.equals("news")&&!empty&&w>=260&&h>=200&&value(c,id,draft,"art","on").equals("on");
        boolean integrated=editorial||pendingHero||photoHero;
        boolean week=kind.equals("schedule")&&!empty&&w>=260&&h>=280&&value(c,id,draft,"week","on").equals("on");
        boolean contextLine=kind.equals("setlist")&&!empty&&!strip&&!narrow&&h>=220;
        float contentHeight=h-(strip?pad*2:pad*2+(h>=200?22:0)+24+(h>=170?36:0));
        if(integrated)contentHeight=h-pad*2-36;
        if(pendingHero)contentHeight+=36;
        if(week)contentHeight-=42;
        if(contextLine)contentHeight-=18;
        int rowHeight=Math.round((density.equals("compact")?44:density.equals("roomy")?64:52)*Math.max(1,scale)*c.getResources().getConfiguration().fontScale);
        int rows=hero||narrow||strip?1:Math.max(1,Math.min(5,(int)(contentHeight/rowHeight)));
        if(kind.equals("quick")&&!narrow&&w>=260) rows=4;
        rows=Math.min(rows,cards.size());
        int pages=Math.max(1,(cards.size()+rows-1)/rows);
        if(kind.equals("pending")&&!empty) pages=1;
        int page=WidgetPolicy.page(draft!=null&&draft.containsKey("previewPage")?draft.getInt("previewPage",0):WidgetStore.page(c,id),pages);
        boolean motion=value(c,id,draft,"motion","on").equals("on") && Settings.Global.getFloat(c.getContentResolver(),Settings.Global.ANIMATOR_DURATION_SCALE,1)>0 && Settings.Global.getFloat(c.getContentResolver(),Settings.Global.TRANSITION_ANIMATION_SCALE,1)>0;
        int frame=motion&&(draft==null||!draft.containsKey("previewPage"))?WidgetStore.prefs(c).getInt(id+".frame",0):0;
        RemoteViews v=new RemoteViews(c.getPackageName(),strip?(motion?R.layout.widget_strip:R.layout.widget_strip_still):(motion?R.layout.widget_shell:R.layout.widget_shell_still));
        v.setInt(R.id.widget_root,"setBackgroundResource",dark?R.drawable.widget_signal:R.drawable.widget_paper);
        v.setViewPadding(R.id.widget_root,dp(c,pad),dp(c,pad),dp(c,pad),dp(c,pad));
        v.setOnClickPendingIntent(R.id.widget_root,ServeSyncWidgetProvider.open(c,id,kind.equals("pending")?ServeSyncWidgetProvider.defaultRoute(kind):cards.get(page*rows).optString("route"),"root"));
        int[] containers={R.id.widget_page_a,R.id.widget_page_b};
        for(int f=0;f<2;f++) {
            v.removeAllViews(containers[f]);
            int p=f==frame?page:WidgetPolicy.page(page-1,pages);
            boolean shortcuts=kind.equals("quick")&&!narrow&&w>=260;
            RemoteViews shortcutGroup=shortcuts?new RemoteViews(c.getPackageName(),R.layout.widget_shortcut_group):null;
            for(int n=p*rows;n<Math.min(cards.size(),(p+1)*rows);n++) {
                JSONObject item=cards.get(n);
                boolean photo=photoHero;
                RemoteViews r=new RemoteViews(c.getPackageName(),shortcuts?R.layout.widget_shortcut:editorial?(signal?R.layout.widget_signal_assignment:R.layout.widget_editorial):pendingHero?R.layout.widget_pending:photo?R.layout.widget_news:hero?R.layout.widget_hero:R.layout.widget_designed_row);
                String title=item.optString("title"), sub=item.optString("subtitle"), detail=item.optString("detail");
                if(kind.equals("pending")&&!empty&&has&&!unavailable) {title=String.valueOf(data.optInt("pendingCount")); sub=narrow?"Awaiting\nyour reply":"Invitations need your reply"; detail="Review invitations";}
                String badge="", key="";
                if(kind.equals("setlist")&&!empty) {
                    int dot=title.indexOf(". "); if(dot>=0){badge=title.substring(0,dot);title=title.substring(dot+2);}
                    int split=title.lastIndexOf(" · "); if(split>=0){key=title.substring(split+3);title=title.substring(0,split);}
                    sub=item.optString("subtitle");
                } else if(!item.optString("date").isEmpty()) {
                    try {Date date=new SimpleDateFormat("yyyy-MM-dd",Locale.US).parse(item.optString("date")); badge=new SimpleDateFormat(hero?"EEE\nd":"MMM\nd",Locale.getDefault()).format(date).toUpperCase(Locale.getDefault());}catch(Exception ignored){}
                }
                float titleSize=shortcuts?12:hero?(kind.equals("pending")&&!empty?Math.min(narrow?42:80,contentHeight*.48f):narrow?16:strip?18:w>=260?29:24):15;
                if(empty)titleSize=narrow?13:strip?15:20;
                titleSize*=scale;
                if(largeType&&hero&&!integrated&&!strip)titleSize=Math.min(titleSize,Math.max(12,(contentHeight-45)/(2.3f*fontScale)));
                if(hero && !strip && contentHeight<110 && !kind.equals("pending"))titleSize=Math.min(titleSize,narrow?14:21);
                text(r,R.id.widget_item_title,title,kind.equals("pending")&&!empty?accent:ink,titleSize);
                text(r,R.id.widget_item_subtitle,sub,muted,(narrow?10:12)*scale);
                text(r,R.id.widget_item_detail,detail,muted,11*scale);
                if(photo){r.setTextColor(R.id.widget_item_title,Color.WHITE);r.setTextColor(R.id.widget_item_subtitle,0xFFEEEEEE);r.setTextColor(R.id.widget_item_detail,0xFFEEEEEE);}
                r.setInt(R.id.widget_item_title,"setMaxLines",strip||!hero?1:narrow?3:2);
                r.setViewVisibility(R.id.widget_item_subtitle,shortcuts||h<72||(strip&&c.getResources().getConfiguration().fontScale>1.15f)||kind.equals("setlist")&&!empty?View.GONE:View.VISIBLE);
                r.setViewVisibility(R.id.widget_item_detail,details&&!strip&&!narrow&&hero&&contentHeight>=130&&!largeType?View.VISIBLE:View.GONE);
                if(!shortcuts) {
                    boolean showBadge=!badge.isEmpty()&&!narrow&&!strip&&w>=240;
                    String accentName=value(c,id,draft,"accent","auto");
                    text(r,R.id.widget_badge,badge,badgeInk(accentName,signal),hero?18:13);
                    r.setInt(R.id.widget_badge,"setBackgroundResource",badge(accentName,signal));
                    r.setViewVisibility(R.id.widget_badge,showBadge?View.VISIBLE:View.GONE);
                    if(!hero){
                        text(r,R.id.widget_key,key,ink,12);r.setViewVisibility(R.id.widget_key,key.isEmpty()?View.GONE:View.VISIBLE);r.setInt(R.id.widget_rule,"setBackgroundColor",dark?0xFF343530:0xFFE8E8E5);
                        r.setInt(R.id.widget_badge,"setBackgroundResource",dark?R.drawable.widget_action_dark:R.drawable.widget_action_light);r.setTextColor(R.id.widget_badge,ink);
                        r.setViewVisibility(R.id.widget_marker,kind.equals("schedule")&&!narrow?View.VISIBLE:View.GONE);r.setInt(R.id.widget_marker,"setBackgroundColor",accent);
                        if(kind.equals("schedule"))r.setInt(R.id.widget_badge,"setBackgroundColor",Color.TRANSPARENT);
                        r.setInt(R.id.widget_key,"setBackgroundResource",dark?R.drawable.widget_action_dark:R.drawable.widget_action_light);
                    }
                    else {
                        boolean art=photo||editorial&&value(c,id,draft,"art","on").equals("on")&&!largeType;
                        r.setViewVisibility(R.id.widget_art,art?View.VISIBLE:View.GONE);
                        r.setImageViewResource(R.id.widget_art,photo||signal?R.drawable.widget_art_signal:R.drawable.widget_art_paper);
                    }
                } else {
                    int[] icons={R.drawable.widget_icon_calendar,R.drawable.widget_icon_music,R.drawable.widget_icon_news,R.drawable.widget_icon_chat};
                    r.setImageViewResource(R.id.widget_icon,icons[n%4]);r.setInt(R.id.widget_icon,"setColorFilter",ink);
                    r.setInt(R.id.widget_icon,"setBackgroundResource",dark?R.drawable.widget_action_dark:R.drawable.widget_action_light);
                    if(n%4==0)r.setTextViewText(R.id.widget_item_title,"Schedule");
                    if(n%4==2)r.setTextViewText(R.id.widget_item_title,"News");
                }
                if(editorial){
                    text(r,R.id.widget_kicker,"NEXT ASSIGNMENT",muted,9);
                    text(r,R.id.widget_card_brand,data.optString("churchName","ServeSync"),muted,10);
                    r.setViewVisibility(R.id.widget_card_brand,value(c,id,draft,"branding","on").equals("on")?View.VISIBLE:View.GONE);
                    r.setTextViewText(R.id.widget_item_title,title);
                    r.setTextColor(R.id.widget_item_title,ink);
                    r.setTextViewTextSize(R.id.widget_item_title,TypedValue.COMPLEX_UNIT_SP,36*scale);
                    text(r,R.id.widget_item_subtitle,sub.contains(" · ")?sub.substring(sub.lastIndexOf(" · ")+3):sub,ink,16*scale);
                    text(r,R.id.widget_item_detail,detail.contains(" · ")?detail.substring(0,detail.indexOf(" · ")):detail,ink,15*scale);
                    r.setViewVisibility(R.id.widget_item_detail,details?View.VISIBLE:View.GONE);
                    r.setViewVisibility(R.id.widget_role_label,details?View.VISIBLE:View.GONE);
                    r.setTextColor(R.id.widget_time_label,muted);r.setTextColor(R.id.widget_role_label,muted);
                    r.setInt(R.id.widget_rule,"setBackgroundColor",dark?0xFF42443C:0xFFCECFCA);
                    r.setImageViewResource(R.id.widget_art,dark?R.drawable.widget_art_signal:R.drawable.widget_art_arch);
                    r.setInt(R.id.widget_art,"setImageAlpha",dark?100:160);
                    if(signal){
                        text(r,R.id.widget_kicker,"Next Assignment",ink,13);
                        text(r,R.id.widget_item_title,title,ink,w<240?16:Math.min(22*scale,largeType?20:22));
                        r.setInt(R.id.widget_item_title,"setMaxLines",1);
                        r.setViewVisibility(R.id.widget_role_label,View.GONE);
                        r.setInt(R.id.widget_badge,"setBackgroundColor",Color.TRANSPARENT);
                        r.setTextColor(R.id.widget_badge,accent);
                        r.setViewVisibility(R.id.widget_badge,View.VISIBLE);
                        if(w<240){r.setViewVisibility(R.id.widget_card_brand,View.GONE);r.setViewVisibility(R.id.widget_item_detail,View.GONE);r.setViewVisibility(R.id.widget_art,View.GONE);}
                        r.setTextViewTextSize(R.id.widget_badge,TypedValue.COMPLEX_UNIT_SP,13);
                        try{Date date=new SimpleDateFormat("yyyy-MM-dd",Locale.US).parse(item.optString("date"));
                            text(r,R.id.widget_date_big,new SimpleDateFormat("d",Locale.US).format(date),ink,80);
                            r.setTextViewText(R.id.widget_badge,new SimpleDateFormat("EEE\nMMM yyyy",Locale.getDefault()).format(date).toUpperCase(Locale.getDefault()));
                        }catch(Exception ignored){r.setViewVisibility(R.id.widget_date_big,View.GONE);}
                    }
                }
                if(pendingHero){
                    text(r,R.id.widget_kicker,"YOUR PENDING\nRESPONSES",ink,10);
                    r.setViewVisibility(R.id.widget_item_detail,View.VISIBLE);
                    text(r,R.id.widget_item_detail,"Review invitations",ink,11);
                    r.setInt(R.id.widget_item_detail,"setBackgroundResource",dark?R.drawable.widget_action_dark:R.drawable.widget_action_light);
                }
                if(photo){
                    r.setImageViewBitmap(R.id.widget_art,photo(c,w,h-36));
                    r.setViewVisibility(R.id.widget_item_subtitle,View.GONE);
                    r.setViewVisibility(R.id.widget_item_detail,h>=280&&!largeType?View.VISIBLE:View.GONE);
                    r.setTextViewTextSize(R.id.widget_item_title,TypedValue.COMPLEX_UNIT_SP,Math.min(34*scale,(contentHeight-55)/(2.4f*fontScale)));
                }
                String route=kind.equals("pending")?ServeSyncWidgetProvider.defaultRoute(kind):item.optString("route");
                r.setOnClickPendingIntent(R.id.widget_item,ServeSyncWidgetProvider.open(c,id,route,"row"+f+"-"+n));
                r.setContentDescription(R.id.widget_item,title+", "+sub+", "+detail+". Tap to open.");
                if(shortcuts)shortcutGroup.addView(R.id.widget_shortcuts,r);else v.addView(containers[f],r);
            }
            if(shortcuts)v.addView(containers[f],shortcutGroup);
        }
        v.setInt(R.id.widget_flipper,"setDisplayedChild",frame);
        v.setInt(R.id.widget_next,"setColorFilter",ink);
        v.setViewVisibility(R.id.widget_next,pages>1&&(!strip||w>=180)?View.VISIBLE:View.GONE);
        v.setOnClickPendingIntent(R.id.widget_next,ServeSyncWidgetProvider.pageIntent(c,id,true));
        if(!strip) {
            text(v,R.id.widget_brand,data.optString("churchName","ServeSync"),muted,10);
            v.setViewVisibility(R.id.widget_brand,!narrow&&h>=200&&value(c,id,draft,"branding","on").equals("on")?View.VISIBLE:View.GONE);
            String heading=kind.equals("pending")?"YOUR PENDING RESPONSES":kind.equals("next")?"NEXT ASSIGNMENT":kind.equals("schedule")?"My Schedule":kind.equals("setlist")?"Setlist":kind.equals("quick")?"Quick Access":"Church News";
            text(v,R.id.widget_heading,narrow?(kind.equals("next")?"UP NEXT":kind.equals("pending")?"PENDING":heading):heading,kind.equals("next")||kind.equals("pending")?muted:ink,narrow?10:kind.equals("next")||kind.equals("pending")?10:17);
            v.setInt(R.id.widget_heading,"setMaxLines",narrow||kind.equals("pending")?2:1);
            v.setViewVisibility(R.id.widget_cover,contextLine&&!signal&&value(c,id,draft,"art","on").equals("on")?View.VISIBLE:View.GONE);
            v.setImageViewResource(R.id.widget_cover,R.drawable.widget_art_paper);
            v.setViewVisibility(R.id.widget_context,contextLine?View.VISIBLE:View.GONE);
            if(contextLine)text(v,R.id.widget_context,cards.get(0).optString("subtitle"),muted,11);
            v.removeAllViews(R.id.widget_week);
            v.setViewVisibility(R.id.widget_week,week?View.VISIBLE:View.GONE);
            if(week)week(c,id,v,cards,page*rows,accent,ink,muted,value(c,id,draft,"accent","auto"),signal);
            v.setViewVisibility(R.id.widget_settings,w>=260&&h>=200?View.VISIBLE:View.GONE);
            v.setInt(R.id.widget_settings,"setColorFilter",muted);
            Intent configure=new Intent(c,WidgetConfigurationActivity.class).setData(Uri.parse("servesync-widget://configure/"+id)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);
            v.setOnClickPendingIntent(R.id.widget_settings,PendingIntent.getActivity(c,id,configure,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
            String updated=has?new SimpleDateFormat("h:mm a",Locale.getDefault()).format(new Date(data.optLong("updatedAt"))):"Open to refresh";
            text(v,R.id.widget_refresh,narrow?(pages>1?(page+1)+"/"+pages:"Open"):(pages>1?(page+1)+" / "+pages+"  ·  ":"")+(has?"Updated ":"")+updated,muted,10);
            v.setOnClickPendingIntent(R.id.widget_refresh,ServeSyncWidgetProvider.open(c,id,ServeSyncWidgetProvider.defaultRoute(kind),"refresh"));
            v.setContentDescription(R.id.widget_refresh,"Open ServeSync to refresh. "+updated);
            v.setInt(R.id.widget_previous,"setColorFilter",ink);
            v.setViewVisibility(R.id.widget_previous,pages>1&&!narrow?View.VISIBLE:View.GONE);
            v.setOnClickPendingIntent(R.id.widget_previous,ServeSyncWidgetProvider.pageIntent(c,id,false));
            v.setViewVisibility(R.id.widget_refresh,narrow&&pages>1?View.GONE:View.VISIBLE);
            v.setViewVisibility(R.id.widget_controls,h>=170?View.VISIBLE:View.GONE);
            v.setViewVisibility(R.id.widget_heading_row,integrated?View.GONE:View.VISIBLE);
            if(integrated)v.setViewVisibility(R.id.widget_brand,View.GONE);
            if(editorial){
                String status=cards.get(page*rows).optString("detail");
                if(status.contains(" · "))v.setTextViewText(R.id.widget_refresh,status.substring(status.lastIndexOf(" · ")+3)+"  ·  "+updated);
            }
            if(pendingHero){v.setViewVisibility(R.id.widget_controls,View.GONE);if(!dark&&!signal)v.setInt(R.id.widget_root,"setBackgroundResource",R.drawable.widget_pending_paper);}
            if(photoHero){
                v.setInt(R.id.widget_root,"setBackgroundResource",R.drawable.widget_signal);v.setTextColor(R.id.widget_refresh,0xFFB8B9B4);v.setInt(R.id.widget_previous,"setColorFilter",Color.WHITE);v.setInt(R.id.widget_next,"setColorFilter",Color.WHITE);
                v.setViewPadding(R.id.widget_root,0,0,0,0);v.setViewPadding(R.id.widget_controls,dp(c,16),0,dp(c,8),0);
            }
        }
        return v;
    }
    private static void week(Context c,int id,RemoteViews root,List<JSONObject> cards,int start,int accent,int ink,int muted,String accentName,boolean signal){
        SimpleDateFormat iso=new SimpleDateFormat("yyyy-MM-dd",Locale.US);iso.setTimeZone(TimeZone.getTimeZone("Asia/Manila"));
        Calendar day=Calendar.getInstance(TimeZone.getTimeZone("Asia/Manila"));
        try{day.setTime(iso.parse(cards.get(start).optString("date")));}catch(Exception ignored){}
        day.add(Calendar.DAY_OF_MONTH,-((day.get(Calendar.DAY_OF_WEEK)+5)%7));
        String[] labels={"MON","TUE","WED","THU","FRI","SAT","SUN"};
        for(int n=0;n<7;n++){
            String date=iso.format(day.getTime()),route="/my-assignments";boolean assigned=false;
            for(JSONObject card:cards)if(date.equals(card.optString("date"))){assigned=true;route=card.optString("route");break;}
            RemoteViews cell=new RemoteViews(c.getPackageName(),R.layout.widget_week_day);
            text(cell,R.id.widget_day_label,labels[n],muted,8);text(cell,R.id.widget_day_number,String.valueOf(day.get(Calendar.DAY_OF_MONTH)),assigned?badgeInk(accentName,signal):ink,12);
            if(signal&&!assigned)cell.setInt(R.id.widget_day_number,"setBackgroundResource",R.drawable.widget_action_light);
            if(assigned)cell.setInt(R.id.widget_day_number,"setBackgroundResource",badge(accentName,signal));
            cell.setContentDescription(R.id.widget_day,date+(assigned?", assignment scheduled":""));
            cell.setOnClickPendingIntent(R.id.widget_day,ServeSyncWidgetProvider.open(c,id,route,"day"+n));root.addView(R.id.widget_week,cell);day.add(Calendar.DAY_OF_MONTH,1);
        }
    }
}
