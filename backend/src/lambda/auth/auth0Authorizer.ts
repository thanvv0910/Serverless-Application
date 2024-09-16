import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register'

import { verify, decode } from 'jsonwebtoken'
import { createLogger } from '../../utils/logger'
import Axios from 'axios'
import { Jwt } from '../../auth/Jwt'
import { JwtPayload } from '../../auth/JwtPayload'

const logger = createLogger('auth')

// to verify JWT token signature.
// To get this URL you need to go to an Auth0 page -> Show Advanced Settings -> Endpoints -> JSON Web Key Set
const jwksUrl = 'https://dev-al001ga6l35o37dn.us.auth0.com/.well-known/jwks.json'

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', event.authorizationToken)
  try {
    const jwtToken = await verifyToken(event.authorizationToken)
    logger.info('User was authorized', jwtToken)

    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}

// async function verifyToken(authHeader: string): Promise<JwtPayload> {
//   logger.info('Verifying token');
//   const token = getToken(authHeader);
//   const jwt: Jwt = decode(token, { complete: true }) as Jwt;
//   const response = await Axios.get(jwksUrl);
//   const keys = response.data.keys;
//   const signingKeys = keys.find(key => key.kid === jwt.header.kid);
//   logger.info('Signing keys created successfully ', signingKeys);

//   if (!signingKeys) throw new Error('Unable to find a signing key that matches the kid');
  
//   const pem = signingKeys.x5c[0];

//   const cert = `-----BEGIN CERTIFICATE-----\n${pem}\n-----END CERTIFICATE-----`
  
//   logger.info('cert: ', cert)
  
//   const tokenVerify = verify(token, cert, { algorithms: ['RS256'] }) as JwtPayload
  
//   logger.info('Verified token ', tokenVerify)
  
//   return tokenVerify;
// }



// async function verifyToken(authHeader: string): Promise<JwtPayload> {
//   const token = getToken(authHeader)
  
//   // TODO: Implement token verification
//   // You should implement it similarly to how it was implemented for the exercise for the lesson 5
//   // You can read more about how to do this here: https://auth0.com/blog/navigating-rs256-and-jwks/
//   const response = await Axios.get(jwksUrl);
//   const jwks = response.data;
//   const keys:any[] = jwks.keys;

//   // Decode the JWT and grab the kid property from the header.
//   const jwt: Jwt = decode(token, { complete: true }) as Jwt
//   //Find the signing key in the filtered JWKS with a matching kid property.  
//   const signingKey = keys.find(key => key.kid === jwt.header.kid);
//   let certValue:string = signingKey.x5c[0];
  
//   certValue = certValue.match(/.{1,64}/g).join('\n');
//   const finalCertKey:string = `-----BEGIN CERTIFICATE-----\n${certValue}\n-----END CERTIFICATE-----\n`;

 
//   let jwtPayload:JwtPayload = verify(token, finalCertKey, { algorithms: ['RS256'] }) as JwtPayload; 
//   return jwtPayload;
// }

async function verifyToken(authHeader: string): Promise<JwtPayload> {
  const token = getToken(authHeader)
  const jwt: Jwt = decode(token, { complete: true }) as Jwt

  // TODO: Implement token verification done
  // You should implement it similarly to how it was implemented for the exercise for the lesson 5
  // You can read more about how to do this here: https://auth0.com/blog/navigating-rs256-and-jwks/
  // return undefined
  const { header } = jwt;

  let key = await getSigningKey(jwksUrl, header.kid)
  return verify(token, key.publicKey, { algorithms: ['RS256'] }) as JwtPayload

}

const getSigningKey = async (jwkurl, kid) => {
  let res = await Axios.get(jwkurl, {
    headers: {
      'Content-Type': 'application/json',
      "Access-Control-Allow-Origin": "*",
      'Access-Control-Allow-Credentials': true,
    }
  });
  let keys  = res.data.keys;
  // since the keys is an array its possible to have many keys in case of cycling.
  const signingKeys = keys.filter(key => key.use === 'sig' // JWK property `use` determines the JWK is for signing
      && key.kty === 'RSA' // We are only supporting RSA
      && key.kid           // The `kid` must be present to be useful for later
      && key.x5c && key.x5c.length // Has useful public keys (we aren't using n or e)
    ).map(key => {
      return { kid: key.kid, nbf: key.nbf, publicKey: certToPEM(key.x5c[0]) };
    });
  const signingKey = signingKeys.find(key => key.kid === kid);
  if(!signingKey){
    throw new Error('Invalid signing keys')
    logger.error("No signing keys found")
  }

  logger.info("Signing keys created successfully ", signingKey)
  return signingKey

};

function certToPEM(cert) {
  cert = cert.match(/.{1,64}/g).join('\n');
  cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----\n`;
  return cert;
}


function getToken(authHeader: string): string {
  if (!authHeader) throw new Error('No authentication header')

  if (!authHeader.toLowerCase().startsWith('bearer '))
    throw new Error('Invalid authentication header')

  const split = authHeader.split(' ')
  const token = split[1]

  return token
}
