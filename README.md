# Mon Pokédex GO

Une application web personnelle pour suivre :

- les Pokémon déjà possédés ;
- le nombre d'exemplaires ;
- les bonbons disponibles par famille ;
- les évolutions réalisables et leurs conditions.

## Lancer l'application

Ouvrir `index.html` dans un navigateur moderne. Pour éviter les restrictions réseau de
certains navigateurs sur les fichiers locaux, il est préférable de lancer un petit serveur :

```powershell
python -m http.server 8000
```

Puis ouvrir <http://localhost:8000>.

Les données personnelles restent dans le stockage local du navigateur. Le catalogue et les
évolutions sont chargés depuis l'API communautaire [PoGoAPI](https://pogoapi.net/).
