//nodejs自带的加密的
const crypto = require('crypto')
const dgram = require('dgram')

const rsa = require('./rsa')


//创世区块，随便找个timestamp算出来的
const initBlock = {
  index: 0,
  data: 'Hello woniu-chain!',
  prevHash: '0',
  timestamp: 1605439591723,
  nonce: 81017,
  hash: '0000af12051159fbfca45a021e4d488f0797bbe56ed6f2a52eda61aad7fd63a8'
}

class Blockchain {
  constructor() {
    this.blockchain = [initBlock]
    this.data = []
    this.difficulty = 4  //算hash的难度  前几位是0

    //所有的网络节点信息，address port
    this.peers = []
    this.remote = {}
    //种子节点
    this.seed = { port: 8001, address: 'localhost' }
    this.udp = dgram.createSocket('udp4')
    this.init()
    // const hash = this.computeHash(0,'0',1605439591723,'Hello woniu-chain!',2)
  }

  init() {
    this.bindP2p()
    this.bindExit()
  }
  bindP2p() {
    //处理发送来的消息
    this.udp.on('message', (data, remote) => {
      const { address, port } = remote
      const action = JSON.parse(data)
      if (action.type) {
        this.dispatch(action, { port, address })
      }
    })
    this.udp.on('listening', () => {
      const address = this.udp.address()
      console.log('[信息] : udp监听完毕 端口是' + address.port);
    })
    //区分种子节点和普通节点 普通节点端口0(意思是随机)、
    //种子节点必须约定好端口号 npm run rev 8001 
    const port = process.argv[2] || 0
    //开启这个节点的端口
    this.startNode(port)
  }
  bindExit() {
    //监听命令行exit事件
    process.on('exit', () => {
      console.log('[信息]: 网络一线牵,珍惜这段缘 再见');
    })
  }
  startNode(port) {
    this.udp.bind(port)
    //不是种子节点要发送信息给种子节点 告诉他我来了
    if (port != 8001) {
      this.send({
        type: 'newpeer',
      }, this.seed.port, this.seed.address)
      //把种子节点加入到本地节点中
      this.peers.push(this.seed)
    }
  }
  //目标端口和地址
  send(message, port, address) {
    // console.log('send',message,port,address);
    this.udp.send(JSON.stringify(message), port, address)
  }

  // 接受到网络的消息在这里处理
  //  remote={port:,address:}
  dispatch(action, remote) {
    switch (action.type) {
      //开了新节点要做的事
      //只有种子节点才会有newpeer事件
      case 'newpeer':
        //种子节点要做的事
        //1.你的公网ip和port是什么
        this.send({
          type: 'remoteAddress',
          data: remote
        }, remote.port, remote.address)
        //2.现在全部节点的列表
        this.send({
          type: 'peerlist',
          data: this.peers
        }, remote.port, remote.address)
        //3.告诉所有已知节点，来了个新节点
        this.boardcast({
          type: 'sayhi',
          data: remote
        })
        //4.告诉你现在区块链的数据
        this.send({
          type: 'blockchain',
          data: JSON.stringify({
            blockchain: this.blockchain,
            trans: this.data
          })
        }, remote.port, remote.address)
        this.peers.push(remote)
        console.log('你好啊,新朋友', remote);
        break
      case 'blockchain':
        //同步本地链
        let allData = JSON.parse(action.data)
        let newChain = allData.blockchain
        let newTrans = allData.trans
        this.replaceChain(newChain)
        this.replaceTrans(newTrans)
        break
      case 'remoteAddress':
        // 存储远程消息,退出的时候用
        this.remote = action.data
        break
      case 'peerlist':
        // 远程告诉我，现在的节点列表
        const newPeers = action.data
        this.addPeers(newPeers)
        break
      //让已知节点列表加入新节点并建立白名单连接
      case 'sayhi':
        let remotePeer = action.data
        this.peers.push(remotePeer)
        console.log('[信息] 新朋友你好');
        this.send({ type: 'hi', data: 'hi' }, remotePeer.port, remotePeer.address)
        break
      //sayhi 再返回hi 就能建立连接了
      case 'hi':
        console.log(`${remote.address}:${remote.port}:${action.data}`);
        break
      case 'trans':
        //网络上收到的交易请求
        //是不是有重复
        if (!this.data.find(v => this.isEqualObj(v, action.data))) {
          console.log('有新的交易,请注意查收');
          console.log(action.data);
          this.addTrans(action.data)
          this.boardcast({
            type: 'trans',
            data: action.data
          })
        }
        break
      case 'mine':
        //网络上有人挖矿成功
        const lastBlock = this.getLastBlock()
        if (lastBlock.hash === action.data.hash) {
          return
        }
        if (this.isValidBlock(action.data, lastBlock)) {
          console.log('[信息] 有朋友挖矿成功');
          this.blockchain.push(action.data)
          this.data = []
          this.boardcast({
            type: 'mine',
            data: action.data
          })
        } else {
          console.log('挖矿的区块不合法');
        }
        break
      default:
        console.log('这个action不认识');
    }
  }

  isEqualObj(obj1, obj2) {
    const key1 = Object.keys(obj1)
    const key2 = Object.keys(obj2)
    if (key1.length !== key2.length) {
      return false
    }
    return key1.every(key => obj1[key] === obj2[key])
  }

  // isEqualPeer(peer1,peer2){
  //   return peer1.address==peer2.address && peer1.port == peer2.port
  // }


  addPeers(peers) {
    peers.forEach(peer => {
      // 新节点如果不存在,就添加到peers里
      //find返回第一个符合条件的元素
      if (!this.peers.find(v => this.isEqualObj(peer, v))) {
        this.peers.push(peer)
      }
    })
  }

  //发送消息给所有节点
  boardcast(action) {
    this.peers.forEach(v => {
      this.send(action, v.port, v.address)
    })
  }

  //获取最后的区块
  getLastBlock() {
    return this.blockchain[this.blockchain.length - 1]
  }

  //查看余额
  //遍历所有block的data查看from和to
  blance(address) {
    //from to amount
    let blance = 0
    this.blockchain.forEach(block => {
      //trans是一个个对象
      //data可能是字符串说明是创世区块
      if (!Array.isArray(block.data)) {
        return
      }
      block.data.forEach(trans => {

        if (address == trans.from) {
          blance -= trans.amount
        }
        if (address == trans.to) {
          blance += trans.amount
        }
      })
    })
    return blance
  }

  //挖矿
  mine(address) {
    //校验所有交易合法性
    //方法1.只要有不合法的就报错
    // if(!this.data.every(v => this.isValidTransfer(v))){
    //   console.log('trans not valid');
    //   return
    // }
    //方法2.过滤不合法
    this.data = this.data.filter(v => this.isValidTransfer(v))

    //1.生成新区块 一页新的记账加入了区块链
    //2.不停的算hash,直到符合难度条件,新增区块

    //挖矿结束 矿工奖励 每次成功给100
    this.transfer('0', address, 100)


    const newBlock = this.generateNewBlock()
    // 区块合法 就新增
    if (this.isValidBlock(newBlock) && this.isValidChain()) {
      this.blockchain.push(newBlock)
      this.data = []
      console.log('[信息] 挖矿成功');
      this.boardcast({
        type: 'mine',
        data: newBlock
      })
      return newBlock
    } else {
      // console.log('Eroor ,Invalid Block');
    }
  }

  //生成新区块
  generateNewBlock() {
    //1.生成新区块 一页新的记账加入了区块链
    //2.不停的算hash,直到符合难度条件,新增区块
    let nonce = 0 //引入nonce不停++来让hash值满足difficuty
    const index = this.blockchain.length //区块的索引值
    const data = this.data
    const prevHash = this.getLastBlock().hash
    let timestamp = new Date().getTime()
    let hash = this.computeHash(index, prevHash, timestamp, data, nonce)

    while (hash.slice(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      nonce++;
      hash = this.computeHash(index, prevHash, timestamp, data, nonce)
    }
    return {
      index,
      data,
      prevHash,
      timestamp,
      nonce,
      hash
    }
  }

  computeHashForBlock({ index, prevHash, timestamp, data, nonce }) {
    return crypto
      .createHash('sha256') //创建sha256加密实例
      .update(index + prevHash + timestamp + data + nonce) //得到hash
      .digest('hex') //16进制
  }

  //计算hash
  computeHash(index, prevHash, timestamp, data, nonce) {
    return crypto
      .createHash('sha256') //创建sha256加密实例
      .update(index + prevHash + timestamp + data + nonce) //得到hash
      .digest('hex') //16进制
  }
  //校验区块 通过上一个区块来校验这个区块
  isValidBlock(newBlock, lastBlock = this.getLastBlock()) {
    // 1.区块的index=最新区块的index+1
    if (newBlock.index !== lastBlock.index + 1) {
      return false
      //2.区块的time 大于最新区块
    } else if (newBlock.timestamp <= lastBlock.timestamp) {
      return false
      //3.最新区块的prevHash等于最新区块Hash
    } else if (newBlock.prevHash !== lastBlock.hash) {
      return false
      //4. 区块的hash符合难度要求
    } else if (newBlock.hash.slice(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      return false
      //5.新区块hash值计算正确
    } else if (newBlock.hash !== this.computeHashForBlock(newBlock)) {
      return false
    }

    return true

  }
  //校验区块链
  isValidChain(chain = this.blockchain) {
    //除创世区块外的区块
    for (let i = chain.length - 1; i >= 1; i--) {
      if (!this.isValidBlock(chain[i], chain[i - 1])) {
        return false
      }
    }
    if (JSON.stringify(chain[0]) !== JSON.stringify(initBlock)) {
      return false
    }
    return true
  }

  isValidTransfer(trans) {
    // 是不是合法转帐
    //地址即是公钥 
    return rsa.verify(trans, trans.from)
  }
  addTrans(trans) {
    if (this.isValidTransfer(trans)) {
      this.data.push(trans)
    }
  }
  replaceTrans(trans) {
    if (trans.every(v => this.isValidTransfer(v))) {
      this.data = trans
    }
  }


  replaceChain(newChain) {
    //先不检验交易
    if (newChain.length === 1) {
      return
    }
    if (this.isValidChain(newChain) && newChain.length > this.blockchain.length) {
      //拷贝一份
      this.blockchain = JSON.parse(JSON.stringify(newChain))
    } else {
      console.log('[错误]:不合法链');
    }
  }


  transfer(from, to, amount) {
    const timestamp = new Date().getTime()
    // 签名校验 (后面完成)
    const signature = rsa.sign({ from, to, amount, timestamp })
    const sigTrans = { from, to, amount, timestamp, signature }
    if (from !== '0') {
      //交易非挖矿
      const blance = this.blance(from)
      if (blance < amount) {
        console.log('not enough blance', from, blance, amount);
        return
      }
      this.boardcast({
        type: 'trans',
        data: sigTrans
      })
    }

    this.data.push(sigTrans)
    return sigTrans
  }
}

module.exports = Blockchain