//公钥可以通过私钥计算出来
let fs = require('fs')
let EC = require('elliptic').ec

let ec = new EC('secp256k1')

let keypair = ec.genKeyPair()

function getPub(prv) {
  return ec.keyFromPrivate(prv).getPublic('hex').toString()
}

//1.获取公司钥对(持久化)
function generateKeys() {
  const fileName = './wallet.json'
  try {
    let res = JSON.parse(fs.readFileSync(fileName))
    if (res.prv && res.pub && getPub(res.prv) == res.pub) {
      keypair = ec.keyFromPrivate(res.prv)
      // console.log(keypair);
      return res
    } else {
      //验证失败 内容不合法(被篡改了) 重新生成即可
      //执行catch重新生成
      throw 'not valid wallet.json'
    }
  } catch (err) {
    //文件不存在 或者文件内容不合法
    const res = {
      prv: keypair.getPrivate('hex').toString(),
      pub: keypair.getPublic('hex').toString()
    }
    fs.writeFileSync(fileName, JSON.stringify(res))
    return res
  }
}

//2.签名
function sign({ from, to, amount, timestamp }) {
  const bufferMsg = Buffer.from(`${timestamp}-${amount}-${from}-${to}`)
  //bufferMsg一开始的值用私钥加密生成signature
  //别人是无法得到私钥的，所以别人无法篡改signature
  //而是否篡改了bufferMsg 我们用公钥转换一下signature与bufferMsg进行比较就能知道
  let signature = Buffer.from(keypair.sign(bufferMsg).toDER()).toString('hex')
  return signature
}
//校验签名 
function verify({ from, to, amount, timestamp, signature }, pub) {
  //校验是没有私钥的
  //keypair只有公钥 来解密sign这个被私钥加密的东西 与bufferMsg进行比较
  const keypairTemp = ec.keyFromPublic(pub, 'hex')
  const bufferMsg = Buffer.from(`${timestamp}-${amount}-${from}-${to}`)
  return keypairTemp.verify(bufferMsg, signature)
}

const keys = generateKeys()
console.log(keys);
module.exports = { sign, verify, keys }
// const trans = {from:'woniu',to:'imooc',amount:100}
// // const trans1 = {from:'woniu',to:'imooc',amount:100}
// const signature = sign(trans)
// trans.signature = signature
// console.log(signature);
// const isVerify = verify(trans,keys.pub)
// console.log(isVerify);