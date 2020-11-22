//开发成命令行工具 
const vorpal = require('vorpal')()
const Table = require('cli-table')

const Blockchain = require('./blockchain')
const rsa = require('./rsa')
const blockchain = new Blockchain()

//[{},{}]
function formateLog(data) {
  if (!data || data.length == 0) {
    return
  }
  if (!Array.isArray(data)) {
    data = [data]
  }
  const first = data[0]
  const head = Object.keys(first)
  const table = new Table({
    head: head,
    colWidths: new Array(head.length).fill(15)
  })
  //[[asd,sd,xcz],[]]`
  const res = data.map(v => {
    return Object.values(v).map(x => JSON.stringify(x, null, 1))
  })
  table.push(
    ...res
  )
  console.log(table.toString());
}

vorpal
  .command('trans <to> <amount>', '转账')
  .action(function (args, callback) {
    //使用本地公钥作为转出地址
    let trans = blockchain.transfer(rsa.keys.pub, args.to, args.amount)
    //trans可能因为余额不够返回空
    if (trans) {
      formateLog(trans)
    }
    callback()
  })


vorpal
  .command('blance <address> ', '查看余额')
  .action(function (args, callback) {
    const blance = blockchain.blance(args.address)
    if (blance) {
      formateLog({ blance, address: args.address })
    }
    callback()
  })

vorpal
  .command('detail <index>', '查看区块详情')
  .action(function (args, callback) {
    const block = blockchain.blockchain[args.index]
    this.log(JSON.stringify(block, null, 2))
    callback()
  })

vorpal
  .command('mine', '挖矿')
  .action(function (args, callback) {
    const newBlock = blockchain.mine(rsa.keys.pub)
    // console.log(newBlock);
    if (newBlock) {
      formateLog(newBlock);
    }
    callback()
  })

vorpal
  .command('blockchain', '查看区块链')
  .action(function (args, callback) {
    formateLog(blockchain.blockchain);
    callback()
  })

vorpal
  .command('pub', '查看公钥')
  .action(function (args, callback) {
    console.log(rsa.keys.pub);
    callback()
  })
vorpal
  .command('peers', '查看网络节点列表')
  .action(function (args, callback) {
    formateLog(blockchain.peers);
    callback()
  })
vorpal
  .command('chat <msg>', '跟别的节点hi一下')
  .action(function (args, callback) {
    blockchain.boardcast({
      type: 'hi',
      data: args.msg
    })
    callback()
  })
vorpal
  .command('pending', '查看还么有被打包的交易')
  .action(function (args, callback) {
    formateLog(blockchain.data)
    callback()
  })

console.log('welcome to woniu-chain');
vorpal.exec('help')
vorpal
  .show()