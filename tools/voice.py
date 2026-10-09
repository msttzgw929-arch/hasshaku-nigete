# Voice generation: AivisSpeech Engine (Style-Bert-VITS2) + emotional model "F2" (JVNV-based).
# Several takes per line with varied intonation/speed; best take chosen by ASR similarity + pitch liveliness.
import requests, json, subprocess, os, sys, numpy as np, parselmouth, difflib, re
E='http://localhost:10101'
sp={s['name']:{t['name']:t['id'] for t in s['styles']} for s in requests.get(E+'/speakers').json()}
V=sp['F2']
# key: text, style, speed, intonation, tempoDynamics, semitone shift
L={
 'call1':("ねぇ〜、どこいくのぉ？　お姉さんと遊びましょ♪",'幸せ',0.92,1.6,1.3,-1.0),
 'call2':("うふふっ、みーつけたっ♪",'幸せ',0.92,1.6,1.3,-1.0),
 'call3':("ほらほら、もっと早く逃げないと、つかまえちゃうわよぉ？",'幸せ',0.97,1.6,1.3,-1.0),
 'call4':("ちっちゃくて、かわいいわねぇ。うふふっ。",'幸せ',0.9,1.5,1.2,-1.5),
 'call5':("まってぇ〜？　逃げちゃ、いやぁん。",'幸せ',0.92,1.6,1.3,-1.0),
 'laugh1':("ぽ、ぽ、ぽ、ぽ……♪",'幸せ',0.8,1.6,1.2,-1.5),
 'laugh2':("ぽぽぽぽぽっ♪　うふふふっ！",'幸せ',0.9,1.7,1.3,-1.0),
 'laugh3':("あははっ！　鬼ごっこ、たのしいわねぇ！",'幸せ',1.0,1.7,1.3,-1.0),
 'irr1':("むぅ〜……ちょこまかと……！",'嫌悪',0.95,1.6,1.3,-1.5),
 'irr2':("なんで捕まらないのよぉ！　イライラするぅっ！",'怒り',1.0,1.7,1.3,-1.0),
 'grow1':("あぁんもうっ！　イライラして、お腹がふくらんじゃうっ！",'怒り',1.02,1.7,1.3,-1.0),
 'grow2':("見なさいよ、このお腹！　ぜーんぶ、あなたのせいなんだからっ！",'怒り',1.0,1.6,1.3,-1.5),
 'grow3':("もう許さないっ！　まだまだ大きくなるわよぉっ！",'怒り',1.0,1.7,1.3,-1.5),
 'grow4':("ふぅ、ふぅ……！　お腹が、とまらないのぉっ！",'怒り',0.95,1.6,1.3,-1.5),
 'smash1':("どいてよぉっ！　じゃまぁっ！",'怒り',1.0,1.7,1.3,-1.0),
 'smash2':("あらぁ、ごめんなさい？　お腹がぶつかっちゃった♪",'幸せ',0.97,1.5,1.2,-1.5),
 'smash3':("おうちなんて、おなかで、ぺちゃんこよっ！",'怒り',1.0,1.7,1.3,-1.0),
 'catch1':("つーかまえたっ♡",'幸せ',0.9,1.6,1.3,-1.0),
 'catch2':("うふふっ、もう、はなさないわよぉ？",'幸せ',0.92,1.5,1.2,-1.5),
 'catch3':("はぁい、つかまえた♪　いい子ねぇ。",'幸せ',0.9,1.6,1.2,-1.5),
 'slap1':("ひゃんっ！",'驚き',1.0,1.7,1.2,-1.0),
 'slap2':("あんっ！　お腹、たたかないでぇ！",'驚き',1.0,1.6,1.3,-1.0),
 'slap3':("やぁんっ！",'驚き',1.05,1.6,1.2,-1.0),
 'slap4':("いたぁいっ！",'悲しみ',0.95,1.5,1.2,-1.0),
 'slap5':("ちょ、ちょっとぉ！　ぷるぷるしちゃうでしょっ！",'驚き',1.05,1.6,1.3,-1.0),
 'esc1':("きゃあっ！　もう〜っ！",'驚き',1.0,1.6,1.3,-1.0),
 'esc2':("あぁん……にげられちゃった……。",'悲しみ',0.95,1.6,1.2,-1.5),
 'esc3':("もうっ！　ひどいじゃないっ！　まちなさーいっ！",'怒り',1.05,1.6,1.3,-1.0),
 'over1':("うふふ……これで、ずぅっと、お姉さんと一緒ね♡",'幸せ',0.88,1.4,1.1,-2.0),
 'start1':("ぽ、ぽ、ぽ……。あら、かわいいぼうや。お姉さんと、鬼ごっこしましょ？",'幸せ',0.9,1.5,1.2,-1.5),
}
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','voice'); os.makedirs(out,exist_ok=True)
tmp='/tmp/takes_hs'; os.makedirs(tmp,exist_ok=True)
from faster_whisper import WhisperModel
asr=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4)
def norm(s): return re.sub(r'[^\u3040-\u30ff\u4e00-\u9fff]','',s).replace('ー','').replace('〜','')
only=sys.argv[1:]
report={}
if only and os.path.exists(out+'/lines.json'): report=json.load(open(out+'/lines.json'))
for k,(t,st,spd,it,td,semi) in L.items():
    if only and k not in only: continue
    best=None
    for j,(dit,dsp) in enumerate([(0,0),(0.25,-0.03),(-0.2,0.03)]+([(0.1,-0.06),(-0.35,0.0),(0.4,0.02)] if only else [])):
        sid=V[st]
        q=requests.post(E+'/audio_query',params={'text':t,'speaker':sid}).json()
        q.update(speedScale=spd+dsp,intonationScale=it+dit,tempoDynamicsScale=td,prePhonemeLength=0.05,postPhonemeLength=0.25)
        fn=f'{tmp}/{k}_{j}.wav'
        if not os.path.exists(fn):
            open(fn,'wb').write(requests.post(E+'/synthesis',params={'speaker':sid},json=q).content)
        aud=parselmouth.Sound(fn).resample(16000).values[0].astype(np.float32)
        segs,_=asr.transcribe(aud,language='ja',beam_size=3)
        hyp=''.join(s.text for s in segs)
        r=difflib.SequenceMatcher(None,norm(hyp),norm(t)).ratio()
        f=parselmouth.Sound(fn).to_pitch().selected_array['frequency']; f=f[f>0]
        rng=12*np.log2(np.percentile(f,95)/np.percentile(f,5)) if len(f)>5 else 0
        score=r+0.01*min(rng,16)
        if best is None or score>best[0]: best=(score,fn,hyp,r,rng)
    _,fn,hyp,r,rng=best
    af=f'rubberband=pitch={2**(semi/12):.4f}:formant=preserved,highpass=f=80,equalizer=f=3500:t=q:w=1.2:g=2,aecho=0.8:0.6:38|77:0.13|0.07,loudnorm=I=-16:TP=-1.5:LRA=11'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',fn,'-af',af,'-ac','1','-ar','44100','-b:a','80k',f'{out}/{k}.mp3'],check=True)
    report[k]=dict(text=t,style=st,asr=hyp,sim=round(r,2),pitch_range_st=round(float(rng),1))
    print(k,st,'->',hyp,round(r,2),flush=True)
json.dump(report,open(out+'/lines.json','w'),ensure_ascii=False,indent=1)
print('DONE')
