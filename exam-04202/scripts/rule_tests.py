"""Binomial tests of simple human 'tricks' over the whole bank. Usage: python3 -I rule_tests.py data/questions.json"""
import json, re, sys
from scipy.stats import binomtest
Q=[q for q in json.load(open(sys.argv[1],encoding='utf-8')) if not q['deleted'] and all(q['opts'])]
S=[q for q in Q if not q['multi']]; M=[q for q in Q if q['multi']]
NEG=re.compile(r"錯誤|有誤|不正確|不是|不屬|不包括|不需|不宜|不可|不必|非屬|何者非|不適|不能|不得|不應|不會|無關|不合理|較差|不恰當|不符|何者為非|不為")
ABS=re.compile(r"均|皆|一定|必須|只要|完全|無須|無需|唯一|僅|所有|即可|絕對|任何|永遠|全部|只有|只需|只能|不必|不需")
def num(s):
    m=re.findall(r"\d+(?:\.\d+)?",s.replace(',','')); return float(m[0]) if m else None
def isnum(q): return all(num(o) is not None and len(re.sub(r"[\d.\s,+\-±°'\"′″a-zA-Z²³/%：:()（）]","",o))<=3 for o in q['opts'])
rows=[]
def test(name, hits, n, p0):
    if n==0: return
    pv=binomtest(hits,n,p0,alternative='greater').pvalue
    rows.append((name,hits,n,hits/n,p0,pv))
# single: numeric rank
NUMQ=[q for q in S if isnum(q)]
for r in range(4):
    h=sum(1 for q in NUMQ if sorted(range(4),key=lambda i:num(q['opts'][i])).index(int(q['ans'])-1)==r)
    test(f"數字題選第{r+1}小",h,len(NUMQ),.25)
h=sum(1 for q in NUMQ if sorted(range(4),key=lambda i:num(q['opts'][i])).index(int(q['ans'])-1) in (1,2)); test("數字題選第2或第3小",h,len(NUMQ),.5)
# single text rules
TXT=[q for q in S if not isnum(q)]
def uniq_pick(qs,f,name):
    h=n=0
    for q in qs:
        c=[i for i,o in enumerate(q['opts']) if f(o,q)]
        if len(c)==1: n+=1; h+= c[0]==int(q['ans'])-1
    test(name,h,n,.25)
neg=[q for q in TXT if NEG.search(q['stem'])]; pos=[q for q in TXT if not NEG.search(q['stem'])]
uniq_pick(neg,lambda o,q:bool(ABS.search(o)),"問「錯誤」的題，選唯一含絕對詞(一定/必須/只要…)的")
uniq_pick(pos,lambda o,q:bool(ABS.search(o)),"問「正確」的題，選唯一含絕對詞的")
uniq_pick(TXT,lambda o,q:'以上皆' in o,"有「以上皆是/皆非」就選它")
uniq_pick(TXT,lambda o,q:len(o)==max(map(len,q['opts'])),"文字題選最長")
uniq_pick(TXT,lambda o,q:len(o)==min(map(len,q['opts'])),"文字題選最短")
uniq_pick(neg,lambda o,q:bool(re.search('不|非|無',o)),"問「錯誤」的題，選唯一含 不/非/無 的")
# options with a digit '31'-type: specific digits in numeric questions
for d in ['1','2','3','4','5','6','7','8','9','0']:
    h=n=0
    for q in NUMQ:
        c=[i for i,o in enumerate(q['opts']) if re.sub(r'\D','',o)[-1:]==d]
        if len(c)==1: n+=1; h+=c[0]==int(q['ans'])-1
    if n>=15: test(f"數字題選唯一「尾數是{d}」的",h,n,.25)
# multi
opts=[(o,str(i+1) in q['ans'],q) for q in M for i,o in enumerate(q['opts'])]
base=sum(c for _,c,_ in opts)/len(opts)
def mtest(name,f):
    sel=[c for o,c,q in opts if f(o,q)]
    test(name,sum(sel),len(sel),base)
mtest("複選：最長的選項是對的",lambda o,q:len(o)==max(map(len,q['opts'])))
mtest("複選：最短的選項是錯的(看對的比率)",lambda o,q:len(o)==min(map(len,q['opts'])))
mtest("複選：含絕對詞的選項是對的",lambda o,q:bool(ABS.search(o)))
mtest("複選：含「可以/可能/通常」是對的",lambda o,q:bool(re.search('可以|可能|通常|一般',o)))
print(f"{'規則':<38}{'命中':>10}{'命中率':>8}{'亂猜':>7}{'p值':>9}")
for name,h,n,r,p0,pv in rows:
    tag='★顯著' if pv<0.01 else ('△邊緣' if pv<0.05 else '✗巧合')
    print(f"{name:<38}{h:>5}/{n:<5}{100*r:>6.1f}%{100*p0:>6.0f}%{pv:>9.3f} {tag}")
