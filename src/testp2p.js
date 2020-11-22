const dgram = require('dgram')
const udp = dgram.createSocket('udp4')

//udp收信息
udp.on('message',(data,remote)=>{
  console.log('accept message' + data.toString());
  console.log(remote);
})
udp.on('listening',function(){
  const address = udp.address()
  console.log('udp server is listening'+address.address+":"+address.port);
})
udp.bind(8002) 


//对方的IP和端口号
function send(message,port,host){
  console.log('send message',message,port,host);
  //Buffer.from存放二进制类型数据的,因为js没有专门保存二进制的类型
  udp.send(Buffer.from(message),port,host)
}

//progress.argv是命令行传数据时候存放数据的地方
const port = progress.argv[2]
const host = progress.argv[3]
if(port&&host){
  send('你好',port,host)
}

