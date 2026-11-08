import unittest
from pipeline.import_streets import import_bounds, validate_response


class StreetImportTest(unittest.TestCase):
    def test_bounds_cover_all_recordings_with_margin_and_retain_previous_extent(self):
        coordinates=[(-3.207,55.919),(-3.166,55.954)]
        previous={'elements':[{'geometry':[{'lon':-3.23,'lat':55.91},{'lon':-3.15,'lat':55.95}]}]}
        south,west,north,east=import_bounds(coordinates,previous)
        self.assertLessEqual(west,-3.23)
        self.assertLessEqual(south,55.91)
        self.assertGreater(north,55.958)
        self.assertGreaterEqual(east,-3.15)

    def test_response_must_be_complete(self):
        way=dict(type='way',id=1,tags={'highway':'footway'},nodes=[1,2],geometry=[dict(lon=-3.2,lat=55.94),dict(lon=-3.19,lat=55.94)])
        self.assertEqual(validate_response({'elements':[way]}),[way])
        for response in [{'remark':'runtime timeout','elements':[way]}, {'elements':[]}, {'elements':[dict(way,nodes=[1])]}, {'elements':[way,way]}]:
            with self.assertRaises(ValueError):validate_response(response)

    def test_empty_or_invalid_coordinates_cannot_replace_network(self):
        for points in [[],[(float('nan'),55.94)],[(200,55.94)]]:
            with self.assertRaises(ValueError):import_bounds(points,{'elements':[]})
