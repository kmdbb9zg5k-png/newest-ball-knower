"""Offline Mesa render of shipped athlete shaders.

Run the JS presentation check with --render-dir first, then pass that directory.
Requires Linux EGL/OpenGL, numpy and Pillow; does not certify phone frame rate.
"""
import sys
import ctypes as C,ctypes.util,json,re,numpy as np
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
D=Path(sys.argv[1]);scene=json.loads((D/'scene.json').read_text());E=C.CDLL(ctypes.util.find_library('EGL'))
def ef(n,r,*args):
 f=getattr(E,n);f.restype=r;f.argtypes=args;return f
get=ef('eglGetProcAddress',C.c_void_p,C.c_char_p)
def gl(n,r,*args):return C.CFUNCTYPE(r,*args)(get(n.encode()))
i=C.c_int;u=C.c_uint;f=C.c_float;p=C.c_void_p;B=C.c_ubyte
plat=C.CFUNCTYPE(p,u,p,C.POINTER(i))(get(b'eglGetPlatformDisplayEXT'));display=plat(0x31DD,None,None);a=i();b=i();assert ef('eglInitialize',u,p,C.POINTER(i),C.POINTER(i))(display,C.byref(a),C.byref(b));ef('eglBindAPI',u,u)(0x30A2);attrs=(i*5)(0x3098,3,0x30FB,3,0x3038);ctx=ef('eglCreateContext',p,p,p,p,C.POINTER(i))(display,None,None,attrs);assert ef('eglMakeCurrent',u,p,p,p,p)(display,None,None,ctx)
def make_shader(src,kind):
 src=re.sub(r'precision (highp|mediump|lowp) (float|int);','',src.replace('#version 300 es','#version 330 core'));s=gl('glCreateShader',u,u)(kind);code=C.c_char_p(src.encode());gl('glShaderSource',None,u,i,C.POINTER(C.c_char_p),p)(s,1,C.byref(code),None);gl('glCompileShader',None,u)(s);ok=i();gl('glGetShaderiv',None,u,u,C.POINTER(i))(s,0x8B81,C.byref(ok));buf=C.create_string_buffer(4096);gl('glGetShaderInfoLog',None,u,i,p,p)(s,4096,None,buf);assert ok.value,buf.value;return s
def program(vs,fs):
 pr=gl('glCreateProgram',u)();
 for s in [make_shader(vs,0x8B31),make_shader(fs,0x8B30)]:gl('glAttachShader',None,u,u)(pr,s)
 gl('glLinkProgram',None,u)(pr);ok=i();gl('glGetProgramiv',None,u,u,C.POINTER(i))(pr,0x8B82,C.byref(ok));buf=C.create_string_buffer(4096);gl('glGetProgramInfoLog',None,u,i,p,p)(pr,4096,None,buf);assert ok.value,buf.value;return pr
def gen(name):
 obj=u();gl(name,None,i,C.POINTER(u))(1,C.byref(obj));return obj.value
def data(name):return (D/name).read_bytes()
W,H=480,520;fb=gen('glGenFramebuffers');gl('glBindFramebuffer',None,u,u)(0x8D40,fb)
for kind,internal in [(0x8CE0,0x8058),(0x8D00,0x81A6)]:
 rb=gen('glGenRenderbuffers');gl('glBindRenderbuffer',None,u,u)(0x8D41,rb);gl('glRenderbufferStorage',None,u,u,i,i)(0x8D41,internal,W,H);gl('glFramebufferRenderbuffer',None,u,u,u,u)(0x8D40,kind,0x8D41,rb)
assert gl('glCheckFramebufferStatus',u,u)(0x8D40)==0x8CD5
def buf(target,raw):
 b=gen('glGenBuffers');gl('glBindBuffer',None,u,u)(target,b);gl('glBufferData',None,u,C.c_size_t,p,u)(target,len(raw),C.c_char_p(raw),0x88E4);return b
vao=gen('glGenVertexArrays');gl('glBindVertexArray',None,u)(vao)
for loc,(name,size) in enumerate([('POSITION',3),('NORMAL',3),('TEXCOORD_0',2),('JOINTS_0',4),('WEIGHTS_0',4),('TANGENT',4)]):
 buf(0x8892,data(name+'.bin'));gl('glEnableVertexAttribArray',None,u)(loc)
 if name=='JOINTS_0':gl('glVertexAttribIPointer',None,u,i,u,i,p)(loc,size,scene['attrs'][name]['type'],0,None)
 else:gl('glVertexAttribPointer',None,u,i,u,B,i,p)(loc,size,scene['attrs'][name]['type'],False,0,None)
buf(0x8893,data('indices.bin'));pr=program(scene['vertex'],scene['fragment']);gl('glUseProgram',None,u)(pr)
def loc(name,prog=pr):return gl('glGetUniformLocation',i,u,C.c_char_p)(prog,name.encode())
def mat(name,value,prog=pr):
 value=np.array(value,dtype=np.float32);gl('glUniformMatrix4fv',None,i,i,B,p)(loc(name,prog),len(value.ravel())//16,False,value.ctypes.data)
def texture(image,unit):
 gl('glActiveTexture',None,u)(0x84C0+unit);tex=gen('glGenTextures');gl('glBindTexture',None,u,u)(0x0DE1,tex);raw=image.convert('RGBA').tobytes();gl('glTexImage2D',None,u,i,i,i,i,i,u,u,p)(0x0DE1,0,0x1908,image.width,image.height,0,0x1908,0x1401,C.c_char_p(raw));gl('glTexParameteri',None,u,u,i)(0x0DE1,0x2801,0x2601);gl('glTexParameteri',None,u,u,i)(0x0DE1,0x2800,0x2601);return tex
for unit,name in enumerate(['baseMap','normalMap','ormMap']):texture(Image.open(D/f'tex{unit}.jpg'),unit);gl('glUniform1i',None,i,i)(loc(name),unit)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',82)
def number(team,value=24):
 im=Image.new('RGBA',(128,128));dr=ImageDraw.Draw(im);dr.text((64,64),str(value),font=font,anchor='mm',fill='#9b3f39' if team else '#f1ead7',stroke_width=4,stroke_fill='#8f3c38' if team else '#b7964f');texture(im,3);gl('glUniform1i',None,i,i)(loc('numberMap'),3)
def camera(eye,target):
 eye=np.array(eye);target=np.array(target);z=eye-target;z=z/np.linalg.norm(z);x=np.cross([0,1,0],z);x=x/np.linalg.norm(x);y=np.cross(z,x);v=np.eye(4);v[:3,:3]=np.array([x,y,z]);v[:3,3]=-v[:3,:3]@eye;q=1/np.tan(np.deg2rad(33)/2);pm=np.zeros((4,4));pm[0,0]=q/(W/H);pm[1,1]=q;pm[2,2]=-1.002;pm[2,3]=-.2002;pm[3,2]=-1;return (pm@v).T.ravel()
groundPr=program('#version 330 core\nlayout(location=0) in vec3 p;uniform mat4 vp;void main(){gl_Position=vp*vec4(p,1.);}', '#version 330 core\nout vec4 color;void main(){color=vec4(.08,.19,.10,1.);}')
groundVao=gen('glGenVertexArrays');gl('glBindVertexArray',None,u)(groundVao);buf(0x8892,np.array([-10,0,-10,10,0,-10,10,0,10,-10,0,-10,10,0,10,-10,0,10],dtype='f4').tobytes());gl('glEnableVertexAttribArray',None,u)(0);gl('glVertexAttribPointer',None,u,i,u,B,i,p)(0,3,0x1406,False,0,None)
ballPr=program('#version 330 core\nlayout(location=0) in vec3 p;uniform mat4 vp;uniform vec3 center;void main(){gl_Position=vp*vec4(p+center,1.);}', '#version 330 core\nout vec4 color;void main(){color=vec4(.43,.19,.07,1.);}')
ballVao=gen('glGenVertexArrays');gl('glBindVertexArray',None,u)(ballVao);vertices=[]
for latitude in range(8):
 for longitude in range(12):
  def point(a,b):
   phi=a*np.pi/8;theta=b*2*np.pi/12;return [.13*np.sin(phi)*np.cos(theta),.11*np.cos(phi),.22*np.sin(phi)*np.sin(theta)]
  for a,b in [(latitude,longitude),(latitude+1,longitude),(latitude+1,longitude+1),(latitude,longitude),(latitude+1,longitude+1),(latitude,longitude+1)]:vertices.extend(point(a,b))
buf(0x8892,np.array(vertices,dtype='f4').tobytes());gl('glEnableVertexAttribArray',None,u)(0);gl('glVertexAttribPointer',None,u,i,u,B,i,p)(0,3,0x1406,False,0,None)
canvas=Image.new('RGB',(W*4,H*2))
for idx,cell in enumerate(scene['poses']):
 group=cell.get('group',[cell]);pose=group[0];eye=[2.7,1.8,4.0] if idx<6 else [-2.7,1.8,-4.0];target=[0,.85,.3]
 if pose['p']['fallen']:eye=[3.1,2.5,4.5];target=[0,.55,1.0]
 if 'group' in cell:eye=[5.2,3.6,6.2];target=[0,.8,.5]
 if cell.get('exchange'):eye=[6,6,-10];target=[1,.9,1.3]
 vp=camera(eye,target)
 gl('glViewport',None,i,i,i,i)(0,0,W,H);gl('glClearColor',None,f,f,f,f)(.035,.055,.08,1);gl('glClear',None,u)(0x4000|0x0100);gl('glEnable',None,u)(0x0B71)
 gl('glUseProgram',None,u)(groundPr);gl('glBindVertexArray',None,u)(groundVao);mat('vp',vp,groundPr);gl('glDrawArrays',None,u,i,i)(4,0,6)
 gl('glUseProgram',None,u)(pr);gl('glBindVertexArray',None,u)(vao);mat('vp',vp);e=np.array(eye,dtype='f4');gl('glUniform3fv',None,i,i,p)(loc('eye'),1,e.ctypes.data)
 for actor in group:
  mat('model',actor['model']);mat('bones[0]',actor['bones'])
  for name,value in [('rival',actor['p']['team']),('controlled',0),('playerSeed',.5)]:gl('glUniform1f',None,i,f)(loc(name),value)
  number(actor['p']['team'],actor['p'].get('number',24));gl('glDrawElements',None,u,i,u,p)(4,scene['indexCount'],scene['indexType'],None)
 if cell.get('ball'):
  gl('glUseProgram',None,u)(ballPr);gl('glBindVertexArray',None,u)(ballVao);mat('vp',vp,ballPr);center=np.array(cell['ball'],dtype='f4');gl('glUniform3fv',None,i,i,p)(loc('center',ballPr),1,center.ctypes.data);gl('glDrawArrays',None,u,i,i)(4,0,len(vertices)//3)
 pixels=C.create_string_buffer(W*H*4);gl('glReadPixels',None,i,i,i,i,u,u,p)(0,0,W,H,0x1908,0x1401,pixels);im=Image.frombytes('RGBA',(W,H),pixels.raw).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');ImageDraw.Draw(im).text((8,8),cell['label'],fill='white');canvas.paste(im,((idx%4)*W,(idx//4)*H))
canvas.save(D/'poses.png');print('Rendered shader and',len(scene['poses']),'pose groups with Mesa; GL error:',gl('glGetError',u)())
