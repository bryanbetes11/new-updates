package com.babcreations.servesync;



import android.app.Activity;

import android.app.Dialog;

import android.appwidget.AppWidgetManager;

import android.content.Intent;

import android.content.res.Configuration;

import android.content.res.ColorStateList;

import android.graphics.Color;

import android.graphics.Typeface;

import android.graphics.drawable.GradientDrawable;

import android.os.Bundle;

import android.view.Gravity;

import android.view.View;

import android.view.ViewGroup;

import android.view.WindowManager;

import android.widget.*;

import org.json.JSONArray;

import org.json.JSONObject;

import java.util.*;



/** Local draft controls share the launcher's renderer. No settings change until Save. */

public class WidgetConfigurationActivity extends Activity {

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    private final Bundle draft = new Bundle();

    private FrameLayout preview;

    private LinearLayout content, eventGroup;

    private TextView previewCaption;

    private boolean dark, ready;

    private int ink, muted, surface, background, border, selected, sizeIndex=0;

    private final List<Runnable> selections = new ArrayList<>();

    private final int[][] SIZES={{160,180},{64,180},{160,76},{160,180},{310,76},{310,230},{310,360}};

    private final String[] SIZE_LABELS={"Current","1 × 2","2 × 1","2 × 2","4 × 1","4 × 2","4 × 3"};



    @Override public void onCreate(Bundle saved) {

        dark=(getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;

        setTheme(R.style.WidgetEditorTheme);

        super.onCreate(saved); setResult(RESULT_CANCELED);

        widgetId=getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID);

        if(!ServeSyncWidgetProvider.owns(this,widgetId)){finish();return;}

        if(saved!=null){if(saved.getBundle("draft")!=null)draft.putAll(saved.getBundle("draft"));sizeIndex=saved.getInt("size",0);}

        if(!draft.containsKey("previewPage"))draft.putInt("previewPage",0);
        Bundle bounds=AppWidgetManager.getInstance(this).getAppWidgetOptions(widgetId);
        SIZES[0]=new int[]{Math.max(40,bounds.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,160)),Math.max(40,bounds.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,180))};
        SIZE_LABELS[0]="Current · "+SIZES[0][0]+" × "+SIZES[0][1];
        ink=Color.parseColor(dark?"#F2F3EF":"#151713");muted=Color.parseColor(dark?"#ABAEA6":"#656A61");

        surface=Color.parseColor(dark?"#232323":"#FFFFFF");background=Color.parseColor(dark?"#121212":"#F3F2EF");

        border=Color.parseColor(dark?"#42463A":"#DADDD2");selected=Color.parseColor(dark?"#F4F4F0":"#20211F");

        if(!draft.containsKey("style"))draft.putString("style",WidgetDesign.signal(value("style","paper"))?"signal":"paper");

        LinearLayout root=column();root.setBackgroundColor(background);if(android.os.Build.VERSION.SDK_INT>=29)root.setForceDarkAllowed(false);setContentView(root);

        root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});

        root.setSystemUiVisibility(dark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        LinearLayout heading=row();heading.setPadding(dp(20),dp(10),dp(20),dp(6));root.addView(heading);

        TextView title=text("Widget studio",25,true);heading.addView(title,new LinearLayout.LayoutParams(0,-2,1));

        Button expand=button("Expand",false);expand.setContentDescription("Expand widget preview");heading.addView(expand);expand.setOnClickListener(v->expandPreview());

        preview=new FrameLayout(this);preview.setBackground(shape(dark?0xFF303030:0xFFE3E1DC,20,0));

        LinearLayout.LayoutParams canvas=new LinearLayout.LayoutParams(-1,dp(previewHeight()));canvas.setMargins(dp(16),dp(6),dp(16),0);root.addView(preview,canvas);

        previewCaption=text("",11,false);previewCaption.setGravity(Gravity.CENTER);previewCaption.setPadding(0,dp(7),0,dp(4));root.addView(previewCaption);

        LinearLayout sizes=row();HorizontalScrollView sizesScroll=horizontal(sizes);root.addView(sizesScroll);

        for(int n=0;n<SIZES.length;n++){final int index=n;Button chip=button(SIZE_LABELS[n],false);chip.setContentDescription("Preview "+SIZE_LABELS[n]);sizes.addView(chip);chip.setOnClickListener(v->{sizeIndex=index;refresh();});selections.add(()->paintChip(chip,sizeIndex==index));}

        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));

        content=column();content.setPadding(dp(20),dp(4),dp(20),dp(20));scroll.addView(content);

        label("Design",17,true);

        LinearLayout designs=row();content.addView(designs);

        styleCard(designs,"paper","Paper / Pulse","Warm white · coral",false);

        styleCard(designs,"signal","Mono / Signal","Charcoal · electric lime",true);

        choices("Widget theme","theme",new String[]{"design","system","light","dark"},new String[]{"Design default","Follow phone","Light","Dark"},"design");

        label("The editor follows your phone. This setting changes only the widget.",12,false);

        choices("Accent","accent",new String[]{"auto","coral","lime","blue","violet","emerald","amber"},new String[]{"Style","Coral","Lime","Blue","Violet","Mint","Gold"},"auto");

        choices("Spacing","density",new String[]{"compact","balanced","roomy"},new String[]{"Compact","Balanced","Roomy"},"balanced");

        choices("Text size","text",new String[]{"small","default","large"},new String[]{"Small","Default","Large"},"default");

        label("Content",17,true);

        select("Widget purpose",ServeSyncWidgetProvider.TITLES,index(ServeSyncWidgetProvider.KINDS,value("kind",ServeSyncWidgetProvider.defaultKind(this,widgetId))),position->{draft.putString("kind",ServeSyncWidgetProvider.KINDS[position]);draft.putInt("previewPage",0);if(eventGroup!=null)eventGroup.setVisibility(position==2?View.VISIBLE:View.GONE);refresh();});

        eventGroup=column();content.addView(eventGroup);LinearLayout outer=content;content=eventGroup;

        List<String> ids=new ArrayList<>(Arrays.asList("")),labels=new ArrayList<>(Arrays.asList("Next approved setlist"));

        JSONArray setlists=WidgetStore.snapshot(this).optJSONArray("setlists");

        if(setlists!=null)for(int i=0;i<setlists.length();i++){JSONObject item=setlists.optJSONObject(i);if(item==null||item.optString("date").compareTo(ServeSyncWidgetProvider.today())<0)continue;ids.add(item.optString("id"));labels.add(item.optString("title")+" · "+item.optString("subtitle"));}

        String event=value("event","");if(!ids.contains(event)){ids.add(event);labels.add("Previously selected event");}

        select("Setlist event",labels.toArray(new String[0]),Math.max(0,ids.indexOf(event)),position->{draft.putString("event",ids.get(position));draft.putInt("previewPage",0);refresh();});content=outer;

        eventGroup.setVisibility(value("kind",ServeSyncWidgetProvider.defaultKind(this,widgetId)).equals("setlist")?View.VISIBLE:View.GONE);

        toggle("Church name","branding","Show your church above the title");

        toggle("Extra details","details","Role and status when there is room");

        toggle("Artwork","art","Decorative artwork in larger cards");

        toggle("Week strip","week","Dates below the agenda in larger schedule widgets");
        toggle("Animate item changes","motion","Short transitions when browsing items");

        label("Sizes are previews. Resize on your home screen; available space depends on your launcher. Tap a card to open it, or use its arrows to browse.",12,false);

        label("Content refreshes while ServeSync is open and expires after 24 hours. Widgets use your signed-in account.",12,false);

        Button reset=button("Reset design",false);content.addView(reset);reset.setOnClickListener(v->{for(String key:WidgetDesign.KEYS)if(!key.equals("kind")&&!key.equals("event"))draft.putString(key,key.equals("style")?"paper":key.equals("theme")?"design":key.equals("accent")?"auto":key.equals("density")?"balanced":key.equals("text")?"default":"on");refresh();});

        LinearLayout actions=row();actions.setPadding(dp(16),dp(6),dp(16),dp(8));actions.setBackgroundColor(surface);root.addView(actions);

        Button cancel=button("Cancel",false),save=button("Save widget",true);actions.addView(cancel,new LinearLayout.LayoutParams(0,dp(50),1));actions.addView(save,new LinearLayout.LayoutParams(0,dp(50),2));

        cancel.setOnClickListener(v->finish());save.setOnClickListener(v->save());

        ready=true;refresh();

    }

    private void save(){

        if(!ServeSyncWidgetProvider.owns(this,widgetId)){finish();return;}

        android.content.SharedPreferences.Editor editor=WidgetStore.prefs(this).edit();

        for(String key:WidgetDesign.KEYS)if(draft.containsKey(key))editor.putString(widgetId+"."+key,draft.getString(key));

        if(!editor.putInt(widgetId+".page",0).putInt(widgetId+".frame",0).commit()){Toast.makeText(this,"Could not save. Please try again.",Toast.LENGTH_LONG).show();return;}

        ServeSyncWidgetProvider.update(this,widgetId);setResult(RESULT_OK,new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,widgetId));finish();

    }

    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putBundle("draft",draft);out.putInt("size",sizeIndex);}

    private String value(String key,String fallback){return draft.containsKey(key)?draft.getString(key,fallback):WidgetStore.get(this,widgetId,key,fallback);}

    private int index(String[] values,String value){return Math.max(0,Arrays.asList(values).indexOf(value));}

    private int dp(float n){return WidgetDesign.dp(this,n);}

    private int previewHeight(){return Math.max(110,Math.min(240,(int)(getResources().getDisplayMetrics().heightPixels/getResources().getDisplayMetrics().density*.29f)));}

    private GradientDrawable shape(int color,int radius,int stroke){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));if(stroke!=0)d.setStroke(dp(1),stroke);return d;}

    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}

    private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setGravity(Gravity.CENTER_VERTICAL);return v;}

    private TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(bold?ink:muted);if(bold)t.setTypeface(null,Typeface.BOLD);return t;}

    private void label(String s,int size,boolean bold){TextView t=text(s,size,bold);t.setPadding(0,dp(14),0,dp(8));content.addView(t);}

    private Button button(String s,boolean primary){Button b=new Button(this);b.setText(s);b.setTextSize(12);b.setAllCaps(false);b.setMinHeight(dp(44));b.setMinimumWidth(dp(60));b.setPadding(dp(12),0,dp(12),0);b.setTextColor(primary?(dark?Color.BLACK:Color.WHITE):ink);b.setBackground(shape(primary?selected:surface,14,primary?0:border));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,dp(44));lp.setMargins(dp(3),dp(3),dp(3),dp(3));b.setLayoutParams(lp);return b;}

    private HorizontalScrollView horizontal(LinearLayout row){HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);scroll.setClipToPadding(false);scroll.setPadding(dp(12),0,dp(12),0);scroll.addView(row);return scroll;}

    private void paintChip(Button b,boolean active){b.setTextColor(active?(dark?Color.BLACK:Color.WHITE):ink);b.setBackground(shape(active?selected:surface,14,active?0:border));b.setSelected(active);}

    private void styleCard(LinearLayout row,String style,String name,String description,boolean signal){
        LinearLayout card=column();card.setPadding(dp(8),dp(8),dp(8),dp(10));card.setContentDescription(name);card.setClickable(true);card.setFocusable(true);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(158),1);lp.setMargins(0,0,dp(8),0);row.addView(card,lp);
        ImageView thumbnail=new ImageView(this);thumbnail.setScaleType(ImageView.ScaleType.FIT_CENTER);card.addView(thumbnail,new LinearLayout.LayoutParams(-1,dp(100)));
        Bundle sample=new Bundle(draft);sample.putString("style",style);sample.putString("theme","design");sample.putString("accent","auto");sample.putString("motion","off");sample.putInt("previewPage",0);
        View rendered=ServeSyncWidgetProvider.render(this,widgetId,310,230,sample).apply(this,new FrameLayout(this));
        rendered.measure(View.MeasureSpec.makeMeasureSpec(dp(310),View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(dp(230),View.MeasureSpec.EXACTLY));rendered.layout(0,0,dp(310),dp(230));
        android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(dp(310),dp(230),android.graphics.Bitmap.Config.ARGB_8888);rendered.draw(new android.graphics.Canvas(bitmap));thumbnail.setImageBitmap(bitmap);thumbnail.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        TextView title=text(name,13,true);title.setPadding(dp(4),dp(8),0,0);card.addView(title);
        TextView hint=text(description,10,false);hint.setPadding(dp(4),dp(2),0,0);card.addView(hint);
        card.setOnClickListener(v->{draft.putString("style",style);refresh();});
        selections.add(()->{boolean active=value("style","paper").equals(style);card.setSelected(active);card.setBackground(shape(surface,18,active?selected:border));card.setContentDescription(name+(active?", selected":""));});
    }
    private void choices(String label,String key,String[] values,String[] labels,String fallback){label(label,13,true);LinearLayout row=row();content.addView(horizontal(row));for(int i=0;i<values.length;i++){final String choice=values[i];Button b=button(labels[i],false);b.setContentDescription(label+": "+labels[i]);row.addView(b);b.setOnClickListener(v->{draft.putString(key,choice);refresh();});selections.add(()->paintChip(b,value(key,fallback).equals(choice)));}}

    private void toggle(String label,String key,String description){Switch s=new Switch(this);s.setText(label);s.setTextSize(14);s.setTextColor(ink);s.setMinHeight(dp(48));s.setPadding(0,dp(5),0,dp(5));content.addView(s);s.setThumbTintList(new ColorStateList(new int[][]{new int[]{android.R.attr.state_checked},new int[]{}},new int[]{selected,muted}));s.setOnCheckedChangeListener((v,on)->{draft.putString(key,on?"on":"off");refresh();});selections.add(()->s.setChecked(value(key,"on").equals("on")));TextView hint=text(description,11,false);content.addView(hint);}

    private interface Selection{void select(int position);}

    private void select(String label,String[] values,int selected,Selection onSelect){label(label,13,true);Spinner spinner=new Spinner(this);ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,values);adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);spinner.setAdapter(adapter);spinner.setSelection(selected);spinner.setContentDescription(label);spinner.setMinimumHeight(dp(48));content.addView(spinner);spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int position,long id){onSelect.select(position);}public void onNothingSelected(AdapterView<?> p){}});}

    private boolean refreshing;

    private void refresh(){if(!ready||refreshing)return;refreshing=true;for(Runnable r:selections)r.run();renderPreview(preview,previewHeight());previewCaption.setText(SIZE_LABELS[sizeIndex]+" · "+(WidgetStore.snapshot(this).has("updatedAt")?"Your saved content":"Open ServeSync to load content")+" · Scaled to fit");refreshing=false;}

    private void renderPreview(FrameLayout host,int maxHeight){

        host.removeAllViews();int[] dim=SIZES[sizeIndex];int available=getResources().getDisplayMetrics().widthPixels-dp(56);float scale=Math.min(1,Math.min((float)available/dp(dim[0]),(float)dp(maxHeight-16)/dp(dim[1])));

        View rendered=ServeSyncWidgetProvider.render(this,widgetId,dim[0],dim[1],draft).apply(this,host);FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(dp(dim[0]),dp(dim[1]),Gravity.CENTER);host.addView(rendered,lp);rendered.setScaleX(scale);rendered.setScaleY(scale);disableClicks(rendered);

        View next=rendered.findViewById(R.id.widget_next);if(next!=null)next.setOnClickListener(v->{draft.putInt("previewPage",draft.getInt("previewPage",0)+1);renderPreview(host,maxHeight);});

        View previous=rendered.findViewById(R.id.widget_previous);if(previous!=null)previous.setOnClickListener(v->{draft.putInt("previewPage",draft.getInt("previewPage",0)-1);renderPreview(host,maxHeight);});

    }

    private void expandPreview(){Dialog dialog=new Dialog(this);LinearLayout body=column();body.setPadding(dp(16),dp(16),dp(16),dp(16));body.setBackgroundColor(background);TextView title=text("Widget preview · "+SIZE_LABELS[sizeIndex],20,true);body.addView(title);FrameLayout large=new FrameLayout(this);body.addView(large,new LinearLayout.LayoutParams(-1,0,1));Button close=button("Back to editing",true);body.addView(close);close.setOnClickListener(v->dialog.dismiss());dialog.setContentView(body);dialog.getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT,WindowManager.LayoutParams.MATCH_PARENT);dialog.show();renderPreview(large,Math.max(180,(int)(getResources().getDisplayMetrics().heightPixels/getResources().getDisplayMetrics().density)-160));}

    private void disableClicks(View v){v.setOnClickListener(null);v.setClickable(false);if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++)disableClicks(((ViewGroup)v).getChildAt(i));}

}
