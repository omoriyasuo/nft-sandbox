/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from 'ethers';
import { Provider } from '@ethersproject/providers';
import type {
  ERC2981Royalties,
  ERC2981RoyaltiesInterface,
} from '../ERC2981Royalties';

const _abi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'royaltyInfo',
    outputs: [
      {
        internalType: 'address',
        name: 'receiver',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'royaltyAmount',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: 'interfaceId',
        type: 'bytes4',
      },
    ],
    name: 'supportsInterface',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export class ERC2981Royalties__factory {
  static readonly abi = _abi;
  static createInterface(): ERC2981RoyaltiesInterface {
    return new utils.Interface(_abi) as ERC2981RoyaltiesInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ERC2981Royalties {
    return new Contract(address, _abi, signerOrProvider) as ERC2981Royalties;
  }
}
