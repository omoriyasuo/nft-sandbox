/* eslint-env mocha */
import { ethers } from 'hardhat';
import { expect } from 'chai';
import {
  // eslint-disable-next-line
  ERC721WithRoyalitiesMetaTx__factory,
  ERC721WithRoyalitiesMetaTx,
  // eslint-disable-next-line
  MinimalForwarder__factory,
  MinimalForwarder,
} from '../typechain';

const EIP712DomainType = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const ForwardRequestType = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'data', type: 'bytes' },
];

type Message = {
  from: string;
  to: string;
  value: number;
  gas: number;
  nonce: number;
  data: string;
};

const createTypedData = (
  chainId: number,
  ForwarderAddress: string,
  message: Message
) => {
  const TypedData = {
    primaryType: 'ForwardRequest' as const,
    types: {
      EIP712Domain: EIP712DomainType,
      ForwardRequest: ForwardRequestType,
    },
    domain: {
      name: 'MinimalForwarder',
      version: '0.0.1',
      chainId,
      verifyingContract: ForwarderAddress,
    },
    message,
  };
  return TypedData;
};

describe('ERC721RoyalitiesMetaTx', () => {
  let contract: ERC721WithRoyalitiesMetaTx;
  let forwarder: MinimalForwarder;
  let signers: any;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  beforeEach(async () => {
    const [deployer, user] = await ethers.getSigners();
    //     const privateKey =
    //       '0x9729e15de7c9c0ec06ebc2ab7f4dcf796f24d5add48ddf3c424a8019e9061ad8';
    //     const user = new ethers.Wallet(privateKey, ethers.provider);
    signers = { deployer, user };
    const name = 'Nameko';
    const symbol = 'NMK';
    const baseTokenURI = 'http://localhost:3000/';

    const MinimalForwarderFactory = await ethers.getContractFactory(
      'MinimalForwarder',
      deployer
    );
    const minimalForwarder = await MinimalForwarderFactory.deploy();
    const ERC721WithRoyalitiesMetaTxFactory = await ethers.getContractFactory(
      'ERC721WithRoyalitiesMetaTx',
      deployer
    );
    const erc721WithRoyalitiesMetaTx =
      await ERC721WithRoyalitiesMetaTxFactory.deploy(
        name,
        symbol,
        baseTokenURI,
        minimalForwarder.address
      );
    contract = new ERC721WithRoyalitiesMetaTx__factory(deployer).attach(
      erc721WithRoyalitiesMetaTx.address
    );
    forwarder = new MinimalForwarder__factory(deployer).attach(
      minimalForwarder.address
    );
  });

  describe('Forwarder', async () => {
    it('trusted forwarder', async () => {
      expect(await contract.isTrustedForwarder(forwarder.address)).to.be.equal(
        true
      );
    });
    it('successful', async () => {
      const { chainId } = await ethers.provider.getNetwork();
      const request = {
        from: signers.user.address,
        to: ZERO_ADDRESS,
        value: 0,
        gas: 1e6,
        nonce: (await forwarder.getNonce(signers.user.address)).toNumber(),
        data: '0x',
      };

      const TypedData = createTypedData(chainId, forwarder.address, request);
      const signature = await ethers.provider.send('eth_signTypedData_v4', [
        signers.user.address,
        TypedData,
      ]);
      expect(await forwarder.verify(request, signature)).to.be.equal(true);
    });
  });

  describe('Mint', async () => {
    it('successful', async () => {
      await contract.mint(signers.deployer.address, 'hogehoge');
      expect(await contract.ownerOf(1)).to.be.equal(signers.deployer.address);
      expect(await contract.tokenURI(1)).to.be.equal('hogehoge');
      expect(await contract.balanceOf(signers.deployer.address)).to.be.eq(1);
    });
    it('must have minter role', async () => {
      await expect(
        contract.connect(signers.user).mint(signers.user.address, 'fugafuga')
      ).to.revertedWith('ERC721WithRoyalities: must have minter role to mint');
    });
  });

  describe('Transfer', async () => {
    beforeEach(async () => {
      await contract.mint(signers.deployer.address, 'hogehoge');
      expect(await contract.ownerOf(1)).to.be.equal(signers.deployer.address);
    });
    it('deployer to user', async () => {
      await contract.transferFrom(
        signers.deployer.address,
        signers.user.address,
        1
      );
      expect(await contract.ownerOf(1)).to.be.equal(signers.user.address);
    });
    it('metatx: deployer to user to deployer', async () => {
      await contract.transferFrom(
        signers.deployer.address,
        signers.user.address,
        1
      );

      const beforeUserBalance = await signers.user.getBalance();
      const beforeDeployerBalance = await signers.deployer.getBalance();
      const nonce = await forwarder.getNonce(signers.user.address);
      const { chainId } = await ethers.provider.getNetwork();
      const data = contract.interface.encodeFunctionData('transferFrom', [
        signers.user.address,
        signers.deployer.address,
        1,
      ]);
      const request = {
        from: signers.user.address,
        to: contract.address,
        value: 0,
        gas: 1e6,
        nonce: nonce.toNumber(),
        data,
      };
      const TypedData = createTypedData(chainId, forwarder.address, request);

      const signature = await ethers.provider.send('eth_signTypedData_v4', [
        signers.user.address,
        TypedData,
      ]);
      await forwarder.verify(request, signature);
      await forwarder.execute(request, signature);
      const afterUserBalance = await signers.user.getBalance();
      const afterDeployerBalance = await signers.deployer.getBalance();
      expect(await contract.ownerOf(1)).to.be.equal(signers.deployer.address);
      expect(afterUserBalance).to.be.equal(beforeUserBalance);
      expect(afterDeployerBalance).to.be.below(beforeDeployerBalance);
    });

    it('transfer of token that is not own', async () => {
      await expect(
        contract.transferFrom(signers.user.address, signers.deployer.address, 1)
      ).to.revertedWith('ERC721: transfer of token that is not own');
    });
  });

  describe('Burn', async () => {
    beforeEach(async () => {
      await contract.mint(signers.deployer.address, 'hogehoge');
      expect(await contract.ownerOf(1)).to.be.equal(signers.deployer.address);
    });
    it('successful', async () => {
      await contract.burn(1);
      expect(await contract.balanceOf(signers.deployer.address)).to.be.equal(0);
      await expect(contract.ownerOf(1)).to.revertedWith(
        'ERC721: owner query for nonexistent token'
      );
    });
    it('transfer and burn', async () => {
      await contract.transferFrom(
        signers.deployer.address,
        signers.user.address,
        1
      );
      expect(await contract.balanceOf(signers.user.address)).to.be.equal(1);
      await contract.connect(signers.user).burn(1);
      await expect(contract.ownerOf(1)).to.revertedWith(
        'ERC721: owner query for nonexistent token'
      );
    });

    it('caller is not owner', async () => {
      await expect(contract.connect(signers.user).burn(1)).to.revertedWith(
        'ERC721Burnable: caller is not owner nor approved'
      );
    });
  });

  describe('Royalty', async () => {
    beforeEach(async () => {
      await contract.mint(signers.deployer.address, 'hogehoge');
    });
    it('successful', async () => {
      // 50.00%
      await contract.setTokenRoyalty(1, signers.deployer.address, 5000);
      const info = await contract.royaltyInfo(1, 10);
      expect(info[0]).to.be.equal(signers.deployer.address);
      // 10 * 5000 / 10000 = 5
      expect(info[1].toNumber()).to.be.equal(5);
    });
    it('must have minter role', async () => {
      await expect(
        contract
          .connect(signers.user)
          .setTokenRoyalty(1, signers.user.address, 5000)
      ).to.revertedWith(
        'ERC721WithRoyalities: must have minter role to set royalty'
      );
    });
    it('too high', async () => {
      await expect(
        // 100.01%
        contract.setTokenRoyalty(1, signers.deployer.address, 10001)
      ).to.revertedWith('ERC2981Royalties: too high');
    });
    it('invalid token id', async () => {
      await expect(
        contract.setTokenRoyalty(2, signers.deployer.address, 5000)
      ).to.revertedWith('ERC721WithRoyalities: invalid token id');
    });
  });
  describe('Pause', async () => {
    it('successful', async () => {
      await contract.pause();
      await expect(
        contract.mint(signers.deployer.address, 'hoge')
      ).to.revertedWith('ERC721Pausable: token transfer while paused');
    });
    it('must have pauser role', async () => {
      await expect(contract.connect(signers.user).pause()).to.revertedWith(
        'ERC721WithRoyalities: must have pauser role to pause'
      );
    });
  });
  describe('Unpause', async () => {
    beforeEach(async () => {
      await contract.pause();
    });
    it('successful', async () => {
      await contract.unpause();
      await contract.mint(signers.deployer.address, 'hogehoge');
      expect(await contract.ownerOf(1)).to.be.equal(signers.deployer.address);
    });
    it('must have pauser role', async () => {
      await expect(contract.connect(signers.user).unpause()).to.revertedWith(
        'ERC721WithRoyalities: must have pauser role to unpause'
      );
    });
  });
});
